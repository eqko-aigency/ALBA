import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createAnthropicToneAnalyzer,
  createFamilyIdResolver,
  createHeuristicToneAnalyzer,
  createMockChatRepository,
  createMockCustodyRepository,
  createMockDocumentRepository,
  createMockExpenseRepository,
  createMockPairingRepository,
  createMockPensionRepository,
  createMockVerbalAgreementRepository,
  createSupabaseChatRepository,
  createSupabaseCustodyRepository,
  createSupabaseDocumentRepository,
  createSupabaseExpenseRepository,
  createSupabasePairingRepository,
  createSupabasePensionRepository,
  createSupabaseVerbalAgreementRepository,
} from "@alba/api-client";
import type {
  ChatRepository,
  CustodyRepository,
  DocumentRepository,
  ExpenseRepository,
  PairingRepository,
  PensionRepository,
  ToneAnalyzer,
  VerbalAgreementRepository,
} from "@alba/core";
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
  mockDocumentRepository?: DocumentRepository;
  mockVerbalAgreementRepository?: VerbalAgreementRepository;
  mockPensionRepository?: PensionRepository;
};

function getMockRepositories(): {
  pairing: PairingRepository;
  chat: ChatRepository;
  custody: CustodyRepository;
  expenses: ExpenseRepository;
  documents: DocumentRepository;
  verbalAgreements: VerbalAgreementRepository;
  pension: PensionRepository;
} {
  globalForMock.mockPairingRepository ??= createMockPairingRepository();
  globalForMock.mockChatRepository ??= createMockChatRepository(globalForMock.mockPairingRepository);
  globalForMock.mockCustodyRepository ??= createMockCustodyRepository(globalForMock.mockPairingRepository);
  globalForMock.mockExpenseRepository ??= createMockExpenseRepository(globalForMock.mockPairingRepository);
  globalForMock.mockDocumentRepository ??= createMockDocumentRepository(globalForMock.mockPairingRepository);
  globalForMock.mockVerbalAgreementRepository ??= createMockVerbalAgreementRepository(
    globalForMock.mockPairingRepository
  );
  globalForMock.mockPensionRepository ??= createMockPensionRepository(globalForMock.mockPairingRepository);
  return {
    pairing: globalForMock.mockPairingRepository,
    chat: globalForMock.mockChatRepository,
    custody: globalForMock.mockCustodyRepository,
    expenses: globalForMock.mockExpenseRepository,
    documents: globalForMock.mockDocumentRepository,
    verbalAgreements: globalForMock.mockVerbalAgreementRepository,
    pension: globalForMock.mockPensionRepository,
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
 *
 * getSession() (no getUser()) a propósito: getSession() lee el JWT ya
 * guardado en la cookie sin red, mientras que getUser() pega otra vez al
 * servidor de Auth de Supabase para revalidarlo — una llamada de red extra
 * que acá es redundante, porque proxy.ts YA corrió esa validación remota
 * (con getUser(), deliberadamente) para esta misma request antes de que
 * llegara hasta acá. Hacerlo dos veces por cada carga de página era un
 * viaje de red entero desperdiciado — la clienta reportó la app "lentísima"
 * y este era un costo fijo en CADA Server Action / Server Component que
 * toca la base, no solo en algunos.
 */
export async function getAuthedSupabaseClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const cookieClient = await createSupabaseServerClient();
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

  return { client, userId: session.user.id };
}

/** Repositorios + identidad del caller para ESTA request. */
export async function getRequestContext(as?: string): Promise<{
  pairing: PairingRepository;
  chat: ChatRepository;
  custody: CustodyRepository;
  expenses: ExpenseRepository;
  documents: DocumentRepository;
  verbalAgreements: VerbalAgreementRepository;
  pension: PensionRepository;
  parentId: string;
}> {
  if (!isSupabaseConfigured) {
    const { resolveDemoParentId } = await import("./demoSession");
    const { pairing, chat, custody, expenses, documents, verbalAgreements, pension } = getMockRepositories();
    return {
      pairing,
      chat,
      custody,
      expenses,
      documents,
      verbalAgreements,
      pension,
      parentId: resolveDemoParentId(as),
    };
  }

  const { client, userId } = await getAuthedSupabaseClient();

  // Un solo resolver de family_id, compartido entre los 7 repositorios de
  // esta request — antes cada uno creaba el suyo, así que una página como
  // Dashboard (pairing + chat + custody + expenses + documents +
  // verbalAgreements + pension, los 7 a la vez) volvía a resolver "a qué
  // familia perteneces" hasta 7 veces por la misma carga, pese a que el
  // resolver ya memoiza por parentId dentro de su propio closure.
  const familyIdResolver = createFamilyIdResolver(client);

  return {
    pairing: createSupabasePairingRepository(client, familyIdResolver),
    chat: createSupabaseChatRepository(client, familyIdResolver),
    custody: createSupabaseCustodyRepository(client, familyIdResolver),
    expenses: createSupabaseExpenseRepository(client, familyIdResolver),
    documents: createSupabaseDocumentRepository(client, familyIdResolver),
    verbalAgreements: createSupabaseVerbalAgreementRepository(client, familyIdResolver),
    pension: createSupabasePensionRepository(client, familyIdResolver),
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
 * Sube una foto adjunta a un mensaje de chat al bucket público "chat-fotos"
 * (ver 0013_chat_mejoras.sql) — mismo patrón que uploadReceiptFile. En modo
 * demo no hay Storage real: devuelve null y el mensaje se manda sin foto.
 */
export async function uploadChatPhoto(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { client, userId } = await getAuthedSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await client.storage
    .from("chat-fotos")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;

  const { data } = client.storage.from("chat-fotos").getPublicUrl(path);
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
