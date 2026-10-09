import type {
  AcceptInvitationInput,
  Child,
  Family,
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
  const families = new Map<string, Family>();
  const familyMembers = new Map<string, Set<string>>(); // familyId -> parentIds
  const memberOf = new Map<string, string>(); // parentId -> familyId
  const children = new Map<string, Child>();
  const invitations = new Map<string, Invitation>();
  const profiles = new Map<string, Parent>();

  return {
    async getOrCreateMyFamily(parentId) {
      const existingFamilyId = memberOf.get(parentId);
      if (existingFamilyId) return families.get(existingFamilyId)!;

      const family: Family = { id: crypto.randomUUID() };
      families.set(family.id, family);
      familyMembers.set(family.id, new Set([parentId]));
      memberOf.set(parentId, family.id);
      return family;
    },

    async getMyChildren(parentId) {
      const familyId = memberOf.get(parentId);
      if (!familyId) return [];
      return [...children.values()].filter((c) => c.familyId === familyId);
    },

    async createChild(parentId, input) {
      const familyId = memberOf.get(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const child: Child = { id: crypto.randomUUID(), familyId, ...input };
      children.set(child.id, child);
      return child;
    },

    async updateChild(parentId, childId, input: UpdateChildInput) {
      const familyId = memberOf.get(parentId);
      const child = children.get(childId);
      if (!child || child.familyId !== familyId) throw new Error("hijo no encontrado");
      child.fullName = input.fullName;
      child.birthDate = input.birthDate;
      return child;
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

    async listPendingInvitations(parentId) {
      const familyId = memberOf.get(parentId);
      if (!familyId) return [];
      return [...invitations.values()].filter((i) => i.familyId === familyId && i.status === "pending");
    },

    async createInvitation(parentId) {
      const familyId = memberOf.get(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const invitation: Invitation = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        familyId,
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

      const members = familyMembers.get(invitation.familyId) ?? new Set<string>();
      members.add(parentId);
      familyMembers.set(invitation.familyId, members);
      memberOf.set(parentId, invitation.familyId);
      invitation.status = "accepted";

      return families.get(invitation.familyId)!;
    },
  };
}
