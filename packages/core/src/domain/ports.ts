import type {
  Child,
  ChatThread,
  CustodyAgreement,
  CustodyEvent,
  CustodySlot,
  Document,
  Expense,
  ExpenseBalance,
  Family,
  Invitation,
  MeetingPlace,
  Message,
  Parent,
  PensionPayment,
  PensionSettings,
  ToneAnalysis,
  VerbalAgreement,
} from "./entities";
import type {
  AcceptInvitationInput,
  CreateThreadInput,
  ExpenseInput,
  PensionPaymentInput,
  PensionSettingsInput,
  RenameThreadInput,
  SendMessageInput,
  SetUsageModeInput,
  UpdateChildDetailsInput,
  UpdateChildInput,
  UpsertProfileInput,
  VerbalAgreementInput,
} from "../validation/schemas";

/**
 * Puerto de dominio para registro/emparejamiento. La implementación real
 * (Supabase) y la de prueba (mock en memoria) viven en @alba/api-client —
 * el dominio no sabe cuál de las dos está detrás.
 *
 * El emparejamiento es a nivel familia (los dos progenitores se vinculan
 * primero), no por hijo — los hijos se agregan después dentro de esa
 * familia. Ver docs/design/ALBA-UI-REFERENCE.md.
 */
export interface PairingRepository {
  getOrCreateMyFamily(parentId: string): Promise<Family>;
  getMyChildren(parentId: string): Promise<Child[]>;
  createChild(parentId: string, input: { fullName: string; birthDate: string }): Promise<Child>;
  updateChild(parentId: string, childId: string, input: UpdateChildInput): Promise<Child>;
  /**
   * Campos extendidos del perfil de hijo (contactos, terapeuta, escuela,
   * alergias, notas) — separado de updateChild (nombre/fecha de nacimiento)
   * a propósito: así el form corto de /perfil nunca manda estos campos y no
   * corre riesgo de pisarlos con null por accidente.
   */
  updateChildDetails(parentId: string, childId: string, input: UpdateChildDetailsInput): Promise<Child>;
  getInvitationByToken(token: string): Promise<Invitation | null>;
  listPendingInvitations(parentId: string): Promise<Invitation[]>;
  createInvitation(parentId: string): Promise<Invitation>;
  acceptInvitation(parentId: string, input: AcceptInvitationInput): Promise<Family>;
  getProfile(parentId: string): Promise<Parent | null>;
  upsertProfile(parentId: string, input: UpsertProfileInput): Promise<Parent>;
  /** Onboarding (W-xx) — elegir si la app se usa unilateral o bilateral. */
  setUsageMode(parentId: string, input: SetUsageModeInput): Promise<Parent>;
  /** Notificaciones (W-xx) — marca "ya vi mis notificaciones hasta ahora". */
  markNotificationsSeen(parentId: string): Promise<Parent>;
  /**
   * Los dos progenitores de la familia (incluyendo al caller) — agregado
   * para el Calendario (W-xx), que necesita poder asignar un slot del
   * convenio a "cuál de los dos progenitores" sin que el dominio invente
   * un concepto nuevo (reutiliza Parent, ya existente).
   */
  listFamilyMembers(parentId: string): Promise<Parent[]>;
}

/**
 * Puerto de dominio para chat. Los hilos y mensajes se filtran por family_id
 * (nunca por progenitor individual), según docs/design/ALBA-UI-REFERENCE.md.
 */
export interface ChatRepository {
  listThreads(parentId: string): Promise<ChatThread[]>;
  createThread(parentId: string, input: CreateThreadInput): Promise<ChatThread>;
  /** Cambiar el título/categoría de un hilo existente — pedido explícito de la clienta. */
  renameThread(parentId: string, input: RenameThreadInput): Promise<ChatThread>;
  listMessages(parentId: string, threadId: string): Promise<Message[]>;
  sendMessage(parentId: string, input: SendMessageInput): Promise<Message>;
  /**
   * Mensajes de TODOS los hilos de la familia desde `sinceIso`, en una sola
   * consulta — para notificaciones (W-xx). A propósito NO es "leer cada
   * hilo completo": eso fue justo el patrón N+1 que hizo lenta la app
   * antes (mismo criterio que el fix de listEventsForRange en Calendario/
   * Dashboard). sinceIso es un timestamp ISO; el resultado no viene
   * ordenado por hilo, solo por fecha.
   */
  listRecentMessages(parentId: string, sinceIso: string): Promise<Message[]>;
  /**
   * Sella la conversación para evidencia (W-xx): calcula una raíz Merkle
   * sobre los hashes de TODOS los mensajes actuales del hilo y la guarda.
   * Se puede volver a llamar más tarde para cubrir mensajes nuevos — cada
   * llamada reemplaza el sello anterior por uno que cubre todo lo que hay
   * hasta ese momento (nunca sellos parciales acumulados).
   */
  sealThread(parentId: string, threadId: string): Promise<ChatThread>;
}

/**
 * Puerto para el Tone Meter — nunca corre en el cliente (la implementación
 * real llama a la API de Anthropic desde el servidor). La de prueba usa un
 * heurístico simple para poder construir y probar el flujo sin API key.
 */
export interface ToneAnalyzer {
  analyze(body: string): Promise<ToneAnalysis>;
}

/**
 * Puerto de dominio para el Calendario compartido. El convenio
 * (CustodyAgreement) es a nivel FAMILIA, no por hijo — una familia con
 * varios hijos comparte un solo convenio y cada slot carga su propio
 * childId/parentId (ver CustodySlot en entities.ts). El campo `childId` de
 * CustodyAgreement queda como cadena vacía en las implementaciones de este
 * puerto: no existe un "hijo dueño" del convenio completo, solo de cada
 * slot individual — se decidió no tocar el tipo existente (instrucción
 * explícita de no reinventar entities.ts) en vez de agregar una variante.
 *
 * findComplianceIssues (packages/core/src/compliance/complianceEngine.ts)
 * sigue siendo el único lugar con lógica de cumplimiento — este puerto solo
 * expone los datos crudos (convenio + eventos) para que la UI lo invoque.
 */
export interface CustodyRepository {
  getMyAgreement(parentId: string): Promise<CustodyAgreement>;
  /** Reemplaza TODOS los slots del convenio por la lista recibida. */
  upsertSlots(parentId: string, slots: CustodySlot[]): Promise<CustodyAgreement>;
  /** weekStart en formato "YYYY-MM-DD" (fecha local, no UTC) — inicio de semana (domingo). */
  listEventsForWeek(parentId: string, weekStart: string): Promise<CustodyEvent[]>;
  /**
   * Mismo resultado que llamar listEventsForWeek varias veces y juntar los
   * resultados, en UNA sola consulta — Calendario (grilla de mes, 6
   * semanas) y Dashboard (cifras del mes) antes disparaban hasta 6 llamadas
   * a listEventsForWeek en paralelo, cada una re-resolviendo family_id y
   * la lista de hijos desde cero. start/end en formato "YYYY-MM-DD"
   * (fecha local), end exclusivo.
   */
  listEventsForRange(parentId: string, start: string, end: string): Promise<CustodyEvent[]>;
  confirmCheckin(parentId: string, childId: string, scheduledAt: string): Promise<CustodyEvent>;
  confirmCheckout(parentId: string, childId: string, scheduledAt: string): Promise<CustodyEvent>;
  /**
   * Catálogo de lugares de encuentro (W-xx) — por FAMILIA, igual criterio
   * que los slots del convenio. Un slot puede referenciar uno de estos
   * lugares vía CustodySlot.placeId; borrar un lugar no borra los slots que
   * lo usaban, solo les deja placeId en null (ver 0020_lugares_encuentro.sql).
   */
  listMeetingPlaces(parentId: string): Promise<MeetingPlace[]>;
  createMeetingPlace(parentId: string, name: string): Promise<MeetingPlace>;
  deleteMeetingPlace(parentId: string, placeId: string): Promise<void>;
}

/**
 * Puerto de dominio para Gastos básicos con comprobantes + balance. Un
 * gasto cuelga de un hijo (childId), que a su vez cuelga de una familia —
 * se filtra por esa cadena, nunca por progenitor individual (mismo
 * criterio que children/custody). La regla "el pagador no puede aprobar o
 * rechazar su propio gasto" se aplica tanto en RLS (0010_gastos.sql) como
 * en la implementación de este puerto, como defensa en profundidad (ver
 * updateChild en supabasePairingRepository.ts para el mismo patrón).
 */
export interface ExpenseRepository {
  listExpenses(parentId: string): Promise<Expense[]>;
  createExpense(parentId: string, input: ExpenseInput): Promise<Expense>;
  updateExpenseStatus(
    parentId: string,
    expenseId: string,
    status: "approved" | "rejected"
  ): Promise<Expense>;
  /** Balance 50/50 sobre gastos "approved" entre el caller y el otro progenitor de su familia. */
  getBalance(parentId: string): Promise<ExpenseBalance>;
}

/**
 * Puerto de dominio para Bóveda — documentos y acuerdos básicos +
 * evidencia digital (hash SHA-256 + Merkle Tree + anclaje blockchain POC).
 * Un documento cuelga de la FAMILIA (familyId), nunca de un progenitor
 * individual — mismo criterio que CustodyAgreement (ver comentario en ese
 * puerto).
 *
 * uploadDocument recibe los BYTES crudos del archivo (fileBytes), no una
 * URL ya subida desde el cliente — a diferencia de ExpenseInput.receiptUrl
 * (donde la subida a Storage ya se resolvió en apps/web antes de llamar al
 * repositorio), acá el hash SHA-256 (computeSha256Hex, ver
 * packages/core/src/evidence/merkleEngine.ts) y la subida a Storage tienen
 * que ocurrir sobre los MISMOS bytes, en la MISMA operación — por eso esta
 * implementación (no el Server Action que la llama) hace ambas cosas,
 * siguiendo al pie de la letra la regla no negociable de README.md: el
 * hash se calcula en el servidor, nunca en el cliente.
 *
 * anchorPendingDocuments es el "anclaje" — un POC de Merkle Tree +
 * referencia de blockchain simulada (ver supabaseDocumentRepository.ts
 * para el detalle y el disclaimer de por qué es un placeholder). Ancla
 * TODOS los documentos "pending" de la familia del caller bajo una sola
 * raíz Merkle compartida; se modeló como método de este puerto (en vez de
 * una función suelta) por el mismo motivo que updateExpenseStatus vive en
 * ExpenseRepository: es una operación de negocio que necesita acceso
 * directo a la fuente de datos, no solo lectura/escritura simple.
 */
export interface DocumentRepository {
  listDocuments(parentId: string): Promise<Document[]>;
  uploadDocument(
    parentId: string,
    input: { title: string; fileBytes: Uint8Array; fileName: string; mimeType: string; childId: string | null }
  ): Promise<Document>;
  getDocument(parentId: string, documentId: string): Promise<Document | null>;
  /** Devuelve solo los documentos recién anclados (antes estaban "pending"). */
  anchorPendingDocuments(parentId: string): Promise<Document[]>;
}

/**
 * Puerto de dominio para Pensión (W-xx) — pago fijo mensual, separado de
 * Gastos (ExpenseRepository). getSettings/upsertSettings son a nivel
 * FAMILIA (ambos progenitores lo configuran juntos, mismo criterio que
 * CustodyRepository.upsertSlots). registerPayment es inmutable una vez
 * creado; confirmPayment es la única escritura posterior, y solo la puede
 * hacer el progenitor que NO pagó (mismo patrón que
 * VerbalAgreementRepository.confirmVerbalAgreement).
 */
export interface PensionRepository {
  getSettings(parentId: string): Promise<PensionSettings | null>;
  upsertSettings(parentId: string, input: PensionSettingsInput): Promise<PensionSettings>;
  listPayments(parentId: string): Promise<PensionPayment[]>;
  registerPayment(parentId: string, input: PensionPaymentInput): Promise<PensionPayment>;
  confirmPayment(parentId: string, paymentId: string): Promise<PensionPayment>;
}

/**
 * Puerto de dominio para Acuerdos verbales (W-xx) — registro liviano de
 * algo que los progenitores acordaron de palabra, sin archivo. Cuelga de
 * la FAMILIA (mismo criterio que Document/CustodyAgreement). Inmutable una
 * vez creado; confirmVerbalAgreement es la única escritura posterior
 * permitida, y solo la puede hacer el progenitor que NO lo creó (ver nota
 * de inmutabilidad en entities.ts).
 */
export interface VerbalAgreementRepository {
  listVerbalAgreements(parentId: string): Promise<VerbalAgreement[]>;
  createVerbalAgreement(parentId: string, input: VerbalAgreementInput): Promise<VerbalAgreement>;
  confirmVerbalAgreement(parentId: string, agreementId: string): Promise<VerbalAgreement>;
}
