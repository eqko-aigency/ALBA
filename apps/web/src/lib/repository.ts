import {
  createAnthropicToneAnalyzer,
  createHeuristicToneAnalyzer,
  createMockChatRepository,
  createMockPairingRepository,
  createSupabaseChatRepository,
  createSupabasePairingRepository,
} from "@alba/api-client";
import type { ChatRepository, PairingRepository, ToneAnalyzer } from "@alba/core";
import { createSupabaseServerClient } from "./supabaseServerClient";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ANTHROPIC_API_KEY (sin NEXT_PUBLIC_) — nunca debe llegar al cliente.
const isAnthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

// El mock sí puede vivir como singleton de proceso: no representa sesiones
// reales, solo datos de prueba compartidos en memoria mientras corre el
// servidor de desarrollo. Sobrevive al hot-reload guardándose en globalThis.
const globalForMock = globalThis as unknown as {
  mockPairingRepository?: PairingRepository;
  mockChatRepository?: ChatRepository;
};

function getMockRepositories(): { pairing: PairingRepository; chat: ChatRepository } {
  globalForMock.mockPairingRepository ??= createMockPairingRepository();
  globalForMock.mockChatRepository ??= createMockChatRepository(globalForMock.mockPairingRepository);
  return { pairing: globalForMock.mockPairingRepository, chat: globalForMock.mockChatRepository };
}

/**
 * Repositorios para ESTA request. En modo Supabase real se construyen de
 * nuevo cada vez, con un cliente atado a la cookie de sesión de quien está
 * pidiendo esto — nunca un singleton (ver supabaseServerClient.ts). En modo
 * demo, sí reusan el mock compartido de proceso.
 */
export async function getRepositories(): Promise<{ pairing: PairingRepository; chat: ChatRepository }> {
  if (!isSupabaseConfigured) return getMockRepositories();

  const client = await createSupabaseServerClient();
  return {
    pairing: createSupabasePairingRepository(client),
    chat: createSupabaseChatRepository(client),
  };
}

/**
 * Quién está haciendo esta petición. En modo demo, el progenitor fijo que
 * indique `as` (ver demoSession.ts). En modo Supabase real, SIEMPRE se lee
 * de la sesión autenticada — nunca de un valor que la propia request pueda
 * inventar — para que coincida con el auth.uid() que evalúa cada política
 * de RLS. Sin sesión real, esto lanza en vez de inventar un id.
 */
export async function getCurrentParentId(as?: string): Promise<string> {
  if (!isSupabaseConfigured) {
    const { resolveDemoParentId } = await import("./demoSession");
    return resolveDemoParentId(as);
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new Error("No hay sesión activa — inicia sesión para continuar.");
  }
  return user.id;
}

const globalForTone = globalThis as unknown as { toneAnalyzer?: ToneAnalyzer };
globalForTone.toneAnalyzer ??= isAnthropicConfigured
  ? createAnthropicToneAnalyzer(process.env.ANTHROPIC_API_KEY!)
  : createHeuristicToneAnalyzer();

export const toneAnalyzer: ToneAnalyzer = globalForTone.toneAnalyzer;
