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
 * Repositorios + identidad del caller para ESTA request, desde UN SOLO
 * cliente de Supabase — nunca uno para los repos y otro aparte para
 * resolver auth.uid() (ver supabaseServerClient.ts para por qué el cliente
 * en sí nunca es un singleton). Repartir la identidad y los repos entre dos
 * clientes construidos por separado causó un bug real en producción:
 * justo después de confirmar el email, el cliente de los repos todavía no
 * tenía la sesión resuelta al momento del insert, y Postgres lo evaluaba
 * como anónimo — "new row violates row-level security policy" — aunque el
 * otro cliente sí devolvía el user.id correcto. Con un solo cliente, el
 * insert y la resolución de auth.uid() ven exactamente el mismo estado de
 * sesión.
 */
export async function getRequestContext(
  as?: string
): Promise<{ pairing: PairingRepository; chat: ChatRepository; parentId: string }> {
  if (!isSupabaseConfigured) {
    const { resolveDemoParentId } = await import("./demoSession");
    const { pairing, chat } = getMockRepositories();
    return { pairing, chat, parentId: resolveDemoParentId(as) };
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new Error("No hay sesión activa — inicia sesión para continuar.");
  }

  return {
    pairing: createSupabasePairingRepository(client),
    chat: createSupabaseChatRepository(client),
    parentId: user.id,
  };
}

/**
 * Repositorio de pairing SIN exigir sesión — para vistas públicas como
 * /invitacion/[token], donde cualquiera con el link debe poder ver el
 * estado de la invitación (pending/expired) sin haber iniciado sesión.
 * No expone parentId porque no hay identidad que resolver acá.
 */
export async function getPublicPairingRepository(): Promise<PairingRepository> {
  if (!isSupabaseConfigured) {
    const { pairing } = getMockRepositories();
    return pairing;
  }
  const client = await createSupabaseServerClient();
  return createSupabasePairingRepository(client);
}

const globalForTone = globalThis as unknown as { toneAnalyzer?: ToneAnalyzer };
globalForTone.toneAnalyzer ??= isAnthropicConfigured
  ? createAnthropicToneAnalyzer(process.env.ANTHROPIC_API_KEY!)
  : createHeuristicToneAnalyzer();

export const toneAnalyzer: ToneAnalyzer = globalForTone.toneAnalyzer;
