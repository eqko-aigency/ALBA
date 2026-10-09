import type { Child, ChatThread, Family, Invitation, Message, Parent, ToneAnalysis } from "./entities";
import type {
  AcceptInvitationInput,
  CreateThreadInput,
  SendMessageInput,
  UpdateChildInput,
  UpsertProfileInput,
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
  getInvitationByToken(token: string): Promise<Invitation | null>;
  listPendingInvitations(parentId: string): Promise<Invitation[]>;
  createInvitation(parentId: string): Promise<Invitation>;
  acceptInvitation(parentId: string, input: AcceptInvitationInput): Promise<Family>;
  getProfile(parentId: string): Promise<Parent | null>;
  upsertProfile(parentId: string, input: UpsertProfileInput): Promise<Parent>;
}

/**
 * Puerto de dominio para chat. Los hilos y mensajes se filtran por family_id
 * (nunca por progenitor individual), según docs/design/ALBA-UI-REFERENCE.md.
 */
export interface ChatRepository {
  listThreads(parentId: string): Promise<ChatThread[]>;
  createThread(parentId: string, input: CreateThreadInput): Promise<ChatThread>;
  listMessages(parentId: string, threadId: string): Promise<Message[]>;
  sendMessage(parentId: string, input: SendMessageInput): Promise<Message>;
}

/**
 * Puerto para el Tone Meter — nunca corre en el cliente (la implementación
 * real llama a la API de Anthropic desde el servidor). La de prueba usa un
 * heurístico simple para poder construir y probar el flujo sin API key.
 */
export interface ToneAnalyzer {
  analyze(body: string): Promise<ToneAnalysis>;
}
