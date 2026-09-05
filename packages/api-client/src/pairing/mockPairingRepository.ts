import type {
  AcceptInvitationInput,
  Child,
  CreateInvitationInput,
  Invitation,
  PairingRepository,
  Parent,
  UpdateChildInput,
  UpsertProfileInput,
} from "@alba/core";

/**
 * Implementación en memoria del mismo puerto que usa Supabase — para
 * construir y probar la UI de registro/emparejamiento antes de que exista
 * un proyecto real. Vive solo mientras corre el proceso del servidor de
 * desarrollo; no persiste entre reinicios.
 */
export function createMockPairingRepository(): PairingRepository {
  const children = new Map<string, Child & { parentIds: string[] }>();
  const invitations = new Map<string, Invitation>();
  const profiles = new Map<string, Parent>();

  return {
    async getMyChildren(parentId) {
      return [...children.values()]
        .filter((c) => c.parentIds.includes(parentId))
        .map(({ id, fullName, birthDate }) => ({ id, fullName, birthDate }));
    },

    async createChild(parentId, input) {
      const child = { id: crypto.randomUUID(), ...input, parentIds: [parentId] };
      children.set(child.id, child);
      return { id: child.id, fullName: child.fullName, birthDate: child.birthDate };
    },

    async updateChild(parentId, childId, input: UpdateChildInput) {
      const child = children.get(childId);
      if (!child || !child.parentIds.includes(parentId)) {
        throw new Error("hijo no encontrado");
      }
      child.fullName = input.fullName;
      child.birthDate = input.birthDate;
      return { id: child.id, fullName: child.fullName, birthDate: child.birthDate };
    },

    async getProfile(parentId) {
      return profiles.get(parentId) ?? null;
    },

    async upsertProfile(parentId, input: UpsertProfileInput) {
      const profile: Parent = {
        id: parentId,
        fullName: input.fullName,
        email: profiles.get(parentId)?.email ?? `${parentId}@demo.local`,
      };
      profiles.set(parentId, profile);
      return profile;
    },

    async getInvitationByToken(token) {
      return [...invitations.values()].find((i) => i.token === token) ?? null;
    },

    async listPendingInvitations(_parentId, childId) {
      return [...invitations.values()].filter((i) => i.childId === childId && i.status === "pending");
    },

    async createInvitation(parentId, input: CreateInvitationInput) {
      const invitation: Invitation = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        childId: input.childId,
        createdByParentId: parentId,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      invitations.set(invitation.id, invitation);
      return invitation;
    },

    async acceptInvitation(parentId, input: AcceptInvitationInput) {
      const invitation = [...invitations.values()].find((i) => i.token === input.token);
      if (!invitation || invitation.status !== "pending" || new Date(invitation.expiresAt) < new Date()) {
        throw new Error("invitación inválida o expirada");
      }
      const child = children.get(invitation.childId);
      if (!child) throw new Error("hijo no encontrado");

      if (!child.parentIds.includes(parentId)) child.parentIds.push(parentId);
      invitation.status = "accepted";

      return { id: child.id, fullName: child.fullName, birthDate: child.birthDate };
    },
  };
}
