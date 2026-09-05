import {
  createAlbaClient,
  createMockChatRepository,
  createMockPairingRepository,
  createSupabaseChatRepository,
  createSupabasePairingRepository,
} from "@alba/api-client";
import type { ChatRepository, PairingRepository } from "@alba/core";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Singleton en globalThis para sobrevivir el hot-reload de Next en desarrollo
// (si no, cada recarga de módulo perdería los datos del mock en memoria).
const globalForAlba = globalThis as unknown as {
  pairingRepository?: PairingRepository;
  chatRepository?: ChatRepository;
};

function buildRepositories(): { pairing: PairingRepository; chat: ChatRepository } {
  if (!isSupabaseConfigured) {
    const pairing = createMockPairingRepository();
    return { pairing, chat: createMockChatRepository(pairing) };
  }

  const client = createAlbaClient({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
  return {
    pairing: createSupabasePairingRepository(client),
    chat: createSupabaseChatRepository(client),
  };
}

const repos = globalForAlba.pairingRepository && globalForAlba.chatRepository
  ? { pairing: globalForAlba.pairingRepository, chat: globalForAlba.chatRepository }
  : buildRepositories();

globalForAlba.pairingRepository = repos.pairing;
globalForAlba.chatRepository = repos.chat;

export const pairingRepository: PairingRepository = repos.pairing;
export const chatRepository: ChatRepository = repos.chat;
