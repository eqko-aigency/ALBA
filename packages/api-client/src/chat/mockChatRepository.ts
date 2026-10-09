import type {
  ChatRepository,
  ChatThread,
  CreateThreadInput,
  Message,
  PairingRepository,
  SendMessageInput,
} from "@alba/core";

/**
 * Implementación en memoria del chat. Depende de PairingRepository para
 * resolver a qué familia pertenece cada progenitor — así ambos repos
 * comparten la misma noción de "familia" sin duplicar ese estado.
 */
export function createMockChatRepository(pairingRepository: PairingRepository): ChatRepository {
  const threads = new Map<string, ChatThread>();
  const messagesByThread = new Map<string, Message[]>();

  return {
    async listThreads(parentId) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      return [...threads.values()].filter((t) => t.familyId === family.id);
    },

    async createThread(parentId, input: CreateThreadInput) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const existing = [...threads.values()].find(
        (t) => t.familyId === family.id && t.topic === input.topic && t.childId === input.childId
      );
      if (existing) return existing;
      const thread: ChatThread = {
        id: crypto.randomUUID(),
        familyId: family.id,
        topic: input.topic,
        childId: input.childId,
        createdAt: new Date().toISOString(),
      };
      threads.set(thread.id, thread);
      messagesByThread.set(thread.id, []);
      return thread;
    },

    async listMessages(_parentId, threadId) {
      return messagesByThread.get(threadId) ?? [];
    },

    async sendMessage(parentId, input: SendMessageInput) {
      if (!threads.has(input.threadId)) throw new Error("hilo no encontrado");
      const message: Message = {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        senderId: parentId,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      const list = messagesByThread.get(input.threadId) ?? [];
      list.push(message);
      messagesByThread.set(input.threadId, list);
      return message;
    },
  };
}
