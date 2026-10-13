import { buildMerkleRoot, computeSha256Hex } from "@alba/core";
import type {
  ChatRepository,
  ChatThread,
  CreateThreadInput,
  Message,
  PairingRepository,
  RenameThreadInput,
  SendMessageInput,
} from "@alba/core";

/** Mismo cálculo que la columna GENERATED de messages.sha256_hex en
 * 0017_chat_hash.sql — se duplica acá porque en modo demo no hay Postgres
 * que lo calcule por nosotros. */
function computeMessageHash(id: string, threadId: string, senderId: string, body: string): string {
  return computeSha256Hex(new TextEncoder().encode(`${id}|${threadId}|${senderId}|${body}`));
}

/** POC de referencia de "sellado" — mismo criterio que buildAnchorReference en supabaseDocumentRepository.ts. */
function buildAnchorReference(merkleRoot: string): string {
  const timestamp = Date.now();
  const short = computeSha256Hex(new TextEncoder().encode(`${merkleRoot}:${timestamp}`)).slice(0, 16);
  return `poc-anchor:0x${short}:${timestamp}`;
}

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
        merkleRoot: null,
        anchorReference: null,
        sealedAt: null,
        sealedMessageCount: 0,
      };
      threads.set(thread.id, thread);
      messagesByThread.set(thread.id, []);
      return thread;
    },

    async renameThread(parentId, input: RenameThreadInput) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const thread = threads.get(input.threadId);
      if (!thread || thread.familyId !== family.id) throw new Error("hilo no encontrado");
      thread.topic = input.topic;
      return thread;
    },

    async listMessages(parentId, threadId) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const thread = threads.get(threadId);
      if (!thread || thread.familyId !== family.id) return [];
      return messagesByThread.get(threadId) ?? [];
    },

    async sendMessage(parentId, input: SendMessageInput) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const thread = threads.get(input.threadId);
      if (!thread || thread.familyId !== family.id) throw new Error("hilo no encontrado");
      const id = crypto.randomUUID();
      const message: Message = {
        id,
        threadId: input.threadId,
        senderId: parentId,
        body: input.body,
        attachmentUrl: input.attachmentUrl ?? null,
        sha256Hex: computeMessageHash(id, input.threadId, parentId, input.body),
        createdAt: new Date().toISOString(),
      };
      const list = messagesByThread.get(input.threadId) ?? [];
      list.push(message);
      messagesByThread.set(input.threadId, list);
      return message;
    },

    async sealThread(parentId, threadId) {
      const family = await pairingRepository.getOrCreateMyFamily(parentId);
      const thread = threads.get(threadId);
      if (!thread || thread.familyId !== family.id) throw new Error("hilo no encontrado");
      const messages = messagesByThread.get(threadId) ?? [];
      if (messages.length === 0) throw new Error("no hay mensajes para sellar");

      const merkleRoot = buildMerkleRoot(messages.map((m) => m.sha256Hex));
      thread.merkleRoot = merkleRoot;
      thread.anchorReference = buildAnchorReference(merkleRoot);
      thread.sealedAt = new Date().toISOString();
      thread.sealedMessageCount = messages.length;
      return thread;
    },
  };
}
