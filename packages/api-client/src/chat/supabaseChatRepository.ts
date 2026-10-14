import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMerkleRoot, computeSha256Hex } from "@alba/core";
import type {
  ChatRepository,
  ChatThread,
  CreateThreadInput,
  Message,
  RenameThreadInput,
  SendMessageInput,
} from "@alba/core";
import { createFamilyIdResolver, type FamilyIdResolver } from "../family/resolveFamilyId";

/** POC de referencia de "sellado" — mismo criterio que buildAnchorReference en supabaseDocumentRepository.ts. */
function buildAnchorReference(merkleRoot: string): string {
  const timestamp = Date.now();
  const short = computeSha256Hex(new TextEncoder().encode(`${merkleRoot}:${timestamp}`)).slice(0, 16);
  return `poc-anchor:0x${short}:${timestamp}`;
}

export function createSupabaseChatRepository(
  client: SupabaseClient,
  familyIdResolver?: FamilyIdResolver
): ChatRepository {
  const getMyFamilyId = familyIdResolver ?? createFamilyIdResolver(client);

  return {
    async listThreads(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client
        .from("chat_threads")
        .select()
        .eq("family_id", familyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapThread);
    },

    async createThread(parentId, input: CreateThreadInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("chat_threads")
        .insert({ family_id: familyId, topic: input.topic, child_id: input.childId, created_by: parentId })
        .select()
        .single();
      if (error) {
        // 23505 = unique_violation — otra request ya creó este mismo hilo
        // (mismo topic + child_id) entre que listThreads() lo chequeó y que
        // esta insert corrió. No es un error real, el hilo ya existe.
        if (error.code === "23505") {
          let query = client.from("chat_threads").select().eq("family_id", familyId).eq("topic", input.topic);
          query = input.childId === null ? query.is("child_id", null) : query.eq("child_id", input.childId);
          const { data: existing, error: fetchError } = await query.single();
          if (fetchError) throw fetchError;
          return mapThread(existing);
        }
        throw error;
      }
      return mapThread(data);
    },

    async renameThread(parentId, input: RenameThreadInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("chat_threads")
        .update({ topic: input.topic })
        .eq("id", input.threadId)
        .eq("family_id", familyId)
        .select()
        .single();
      if (error) throw error;
      return mapThread(data);
    },

    async listMessages(parentId, threadId) {
      // RLS ya scopea messages por family_id vía chat_threads, pero chequear
      // también acá da defensa en profundidad (mismo criterio que
      // updateChild en supabasePairingRepository y el chat mock) en vez de
      // depender únicamente de que la política de RLS esté bien.
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data: thread, error: threadError } = await client
        .from("chat_threads")
        .select("family_id")
        .eq("id", threadId)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread || thread.family_id !== familyId) return [];

      const { data, error } = await client
        .from("messages")
        .select()
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapMessage);
    },

    async sendMessage(parentId, input: SendMessageInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data: thread, error: threadError } = await client
        .from("chat_threads")
        .select("family_id")
        .eq("id", input.threadId)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread || thread.family_id !== familyId) throw new Error("hilo no encontrado");

      const { data, error } = await client
        .from("messages")
        .insert({
          thread_id: input.threadId,
          sender_id: parentId,
          body: input.body,
          attachment_url: input.attachmentUrl ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapMessage(data);
    },

    async listRecentMessages(parentId, sinceIso) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];

      // Dos consultas en total (hilos de la familia, luego mensajes en
      // esos hilos) sin importar cuántos hilos haya — nunca una consulta
      // por hilo.
      const { data: threadRows, error: threadsError } = await client
        .from("chat_threads")
        .select("id")
        .eq("family_id", familyId);
      if (threadsError) throw threadsError;
      const threadIds = (threadRows ?? []).map((t: any) => t.id);
      if (threadIds.length === 0) return [];

      const { data, error } = await client
        .from("messages")
        .select()
        .in("thread_id", threadIds)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapMessage);
    },

    async sealThread(parentId, threadId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");

      const { data: thread, error: threadError } = await client
        .from("chat_threads")
        .select("family_id")
        .eq("id", threadId)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread || thread.family_id !== familyId) throw new Error("hilo no encontrado");

      const { data: messages, error: messagesError } = await client
        .from("messages")
        .select("sha256_hex")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (messagesError) throw messagesError;
      if (!messages || messages.length === 0) throw new Error("no hay mensajes para sellar");

      // La raíz Merkle se calcula en código de aplicación (mismo motor que
      // Bóveda, buildMerkleRoot) sobre hashes YA calculados por la base
      // (columna GENERATED en 0017_chat_hash.sql) — esta función SQL
      // (seal_chat_thread) solo persiste el resultado, nunca recalcula
      // nada, igual criterio que anchor_pending_documents.
      const merkleRoot = buildMerkleRoot(messages.map((m: any) => m.sha256_hex));
      const anchorReference = buildAnchorReference(merkleRoot);

      const { data, error } = await client.rpc("seal_chat_thread", {
        p_thread_id: threadId,
        p_merkle_root: merkleRoot,
        p_anchor_reference: anchorReference,
        p_message_count: messages.length,
      });
      if (error) throw error;
      return mapThread(data);
    },

    async setAgreementSuggestion(parentId, threadId, suggestion) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");

      const { data: thread, error: threadError } = await client
        .from("chat_threads")
        .select("family_id")
        .eq("id", threadId)
        .maybeSingle();
      if (threadError) throw threadError;
      if (!thread || thread.family_id !== familyId) throw new Error("hilo no encontrado");

      const { data, error } = await client
        .from("chat_threads")
        .update({
          pending_agreement_suggestion: suggestion?.description ?? null,
          pending_agreement_suggestion_based_on: suggestion?.basedOnMessageId ?? null,
        })
        .eq("id", threadId)
        .select()
        .single();
      if (error) throw error;
      return mapThread(data);
    },
  };
}

function mapThread(row: any): ChatThread {
  return {
    id: row.id,
    familyId: row.family_id,
    topic: row.topic,
    childId: row.child_id,
    createdAt: row.created_at,
    merkleRoot: row.merkle_root ?? null,
    anchorReference: row.anchor_reference ?? null,
    sealedAt: row.sealed_at ?? null,
    sealedMessageCount: row.sealed_message_count ?? 0,
    pendingAgreementSuggestion: row.pending_agreement_suggestion ?? null,
    pendingAgreementSuggestionBasedOn: row.pending_agreement_suggestion_based_on ?? null,
  };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    body: row.body,
    attachmentUrl: row.attachment_url ?? null,
    sha256Hex: row.sha256_hex,
    createdAt: row.created_at,
  };
}
