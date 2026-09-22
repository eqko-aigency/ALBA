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
      if (error) throw error;
      return mapThread(data);
    },

    async listMessages(_parentId, threadId) {
      const { data, error } = await client
        .from("messages")
        .select()
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapMessage);
    },

    async sendMessage(parentId, input: SendMessageInput) {
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
