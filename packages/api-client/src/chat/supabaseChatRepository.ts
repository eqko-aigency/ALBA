import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatRepository, ChatThread, CreateThreadInput, Message, SendMessageInput } from "@alba/core";
import { createFamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseChatRepository(client: SupabaseClient): ChatRepository {
  const getMyFamilyId = createFamilyIdResolver(client);

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
        .insert({ thread_id: input.threadId, sender_id: parentId, body: input.body })
        .select()
        .single();
      if (error) throw error;
      return mapMessage(data);
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
  };
}

function mapMessage(row: any): Message {
  return { id: row.id, threadId: row.thread_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at };
}
