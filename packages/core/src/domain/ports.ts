import type { Child, Invitation, Parent } from "./entities";
import type {
  AcceptInvitationInput,
  CreateInvitationInput,
  UpdateChildInput,
  UpsertProfileInput,
} from "../validation/schemas";

/**
 * Puerto de dominio para registro/emparejamiento. La implementación real
 * (Supabase) y la de prueba (mock en memoria) viven en @alba/api-client —
 * el dominio no sabe cuál de las dos está detrás.
 */
export interface PairingRepository {
  getMyChildren(parentId: string): Promise<Child[]>;
  createChild(parentId: string, input: { fullName: string; birthDate: string }): Promise<Child>;
  updateChild(parentId: string, childId: string, input: UpdateChildInput): Promise<Child>;
  getInvitationByToken(token: string): Promise<Invitation | null>;
  listPendingInvitations(parentId: string, childId: string): Promise<Invitation[]>;
  createInvitation(parentId: string, input: CreateInvitationInput): Promise<Invitation>;
  acceptInvitation(parentId: string, input: AcceptInvitationInput): Promise<Child>;
  getProfile(parentId: string): Promise<Parent | null>;
  upsertProfile(parentId: string, input: UpsertProfileInput): Promise<Parent>;
}
