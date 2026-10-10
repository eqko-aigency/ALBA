import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createAnthropicToneAnalyzer,
  createHeuristicToneAnalyzer,
  createMockChatRepository,
  createMockCustodyRepository,
  createMockExpenseRepository,
  createMockPairingRepository,
  createSupabaseChatRepository,
  createSupabaseCustodyRepository,
  createSupabaseExpenseRepository,
  createSupabasePairingRepository,
} from "@alba/api-client";
import type { ChatRepository, CustodyRepository, ExpenseRepository, PairingRepository, ToneAnalyzer } from "@alba/core";
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
  mockCustodyRepository?: CustodyRepository;
  mockExpenseRepository?: ExpenseRepository;
};

function getMockRepositories(): {
  pairing: PairingRepository;
  chat: ChatRepository;
  custody: CustodyRepository;
  expenses: ExpenseRepository;
} {
  globalForMock.mockPairingRepository ??= createMockPairingRepository();
  globalForMock.mockChatRepository ??= createMockChatRepository(globalForMock.mockPairingRepository);
  globalForMock.mockCustodyRepository ??= createMockCustodyRepository(globalForMock.mockPairingRepository);
  globalForMock.mockExpenseRepository ??= createMockExpenseRepository(globalForMock.mockPairingRepository);
  return {
    pairing: globalForMock.mockPairingRepository,
    chat: globalForMock.mockChatRepository,
    custody: globalForMock.mockCustodyRepository,
    expenses: globalForMock.mockExpenseRepository,
  };
}

/**
 * Cliente de Supabase + identidad del caller ya validados, para ESTA
 * request. Extraído como función propia (antes vivía inline dentro de
 * getRequestContext) para poder reutilizarlo también en uploadReceiptFile
 * (comprobantes de gastos vía Supabase Storage) sin duplicar esta lógica.
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
async function getAuthedSupabaseClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const cookieClient = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await cookieClient.auth.getUser();
  if (error || !user) {
    throw new Error("No hay sesión activa — inicia sesión para continuar.");
  }

  const {
    data: { session },
  } = await cookieClient.auth.getSession();
  if (!session) {
    throw new Error("No hay sesión activa — inicia sesión para continuar.");
  }

  // client.auth.setSession() (no un header de Authorization armado a mano)
  // es la forma documentada de hidratar un cliente nuevo con una sesión ya
  // validada: el PostgrestClient interno de supabase-js deriva el header
  // Authorization de su propio auth.getSession() en cada request, así que
  // un header puesto a mano en `global.headers` puede quedar pisado por esa
  // lógica interna — eso fue lo que pasó en el intento anterior.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: setSessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (setSessionError) {
    throw new Error("No se pudo validar la sesión — inicia sesión de nuevo.");
  }

  return { client, userId: user.id };
}

/** Repositorios + identidad del caller para ESTA request. */
export async function getRequestContext(as?: string): Promise<{
  pairing: PairingRepository;
  chat: ChatRepository;
  custody: CustodyRepository;
  expenses: ExpenseRepository;
  parentId: string;
}> {
  if (!isSupabaseConfigured) {
    const { resolveDemoParentId } = await import("./demoSession");
    const { pairing, chat, custody, expenses } = getMockRepositories();
    return { pairing, chat, custody, expenses, parentId: resolveDemoParentId(as) };
  }

  const { client, userId } = await getAuthedSupabaseClient();

  return {
    pairing: createSupabasePairingRepository(client),
    chat: createSupabaseChatRepository(client),
    custody: createSupabaseCustodyRepository(client),
    expenses: createSupabaseExpenseRepository(client),
    parentId: userId,
  };
}

/**
 * Sube un comprobante al bucket de Storage "comprobantes" (ver
 * 0010_gastos.sql) y devuelve su URL pública. En modo demo (sin Supabase
 * real) no hay Storage al que subir nada — devuelve null y el formulario de
 * /gastos cae al campo manual de URL de comprobante (ver GASTOS_DESIGN en
 * apps/web/src/app/gastos/actions.ts).
 */
export async function uploadReceiptFile(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { client, userId } = await getAuthedSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await client.storage
    .from("comprobantes")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;

  const { data } = client.storage.from("comprobantes").getPublicUrl(path);
  return data.publicUrl;
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
