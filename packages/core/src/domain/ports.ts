import type { Child, Family, Invitation, Parent } from "./entities";
import type { AcceptInvitationInput, UpdateChildInput, UpsertProfileInput } from "../validation/schemas";

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
