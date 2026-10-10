import { createClient } from "@supabase/supabase-js";
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
 * Repositorios + identidad del caller para ESTA request.
 *
 * Unificar en un solo cliente cookie-based (en vez de uno para los repos y
 * otro aparte para resolver auth.uid(), como estaba antes) no bastó: en
 * producción, confirmado en los logs de Postgres de Supabase, getUser() SÍ
 * validaba la sesión y devolvía el user.id correcto, pero el insert
 * inmediatamente después llegaba a Postgres con auth_user: null — el
 * cliente de @supabase/ssr (createServerClient, atado a cookies vía
 * next/headers) no estaba propagando el Authorization header de la sesión a
 * cada request de postgrest de forma confiable dentro de un Server
 * Component. Por eso acá se arma un segundo cliente, SIN estado de cookies,
 * con el access_token de la sesión ya validada puesto explícitamente como
 * header — así el insert nunca depende de esa propagación implícita.
 */
export async function getRequestContext(
  as?: string
): Promise<{ pairing: PairingRepository; chat: ChatRepository; parentId: string }> {
  if (!isSupabaseConfigured) {
    const { resolveDemoParentId } = await import("./demoSession");
    const { pairing, chat } = getMockRepositories();
    return { pairing, chat, parentId: resolveDemoParentId(as) };
  }

  // DEBUG TEMPORAL — try/catch de blindaje: quitar junto con los
  // console.error de abajo en cuanto se resuelva el bug de RLS en
  // producción. Los intentos previos de loguear esto nunca imprimían nada
  // en los Runtime Logs de Vercel pese a 500s reproducibles, lo que sugiere
  // que algo está lanzando ANTES de llegar a esas líneas — este try/catch
  // envuelve TODO el cuerpo para no perder ninguna excepción.
  try {
    const cookieClient = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await cookieClient.auth.getUser();
    console.error("[DEBUG] getUser", { hasUser: !!user, userId: user?.id, errorMsg: error?.message });
    if (error || !user) {
      throw new Error("No hay sesión activa — inicia sesión para continuar.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await cookieClient.auth.getSession();
    console.error("[DEBUG] getSession", {
      hasSession: !!session,
      sessionUserId: session?.user?.id,
      accessTokenLen: session?.access_token?.length ?? 0,
      sessionErrorMsg: sessionError?.message,
    });
    if (!session) {
      throw new Error("No hay sesión activa — inicia sesión para continuar.");
    }

    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [selfSelect, jwtClaim] = await Promise.all([
      client.from("profiles").select("id").eq("id", user.id).maybeSingle(),
      client.rpc("debug_jwt_claims" as never).then(
        (r) => r,
        (e) => ({ data: null, error: String(e) })
      ),
    ]);
    console.error("[DEBUG] built client", {
      userId: user.id,
      selfSelectData: selfSelect.data,
      selfSelectError: selfSelect.error,
      jwtClaim,
    });

    return {
      pairing: createSupabasePairingRepository(client),
      chat: createSupabaseChatRepository(client),
      parentId: user.id,
    };
  } catch (e) {
    console.error(
      "[DEBUG] CAUGHT in getRequestContext",
      e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : e
    );
    throw e;
  }
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
