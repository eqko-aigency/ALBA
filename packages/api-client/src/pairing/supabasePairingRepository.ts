import type { SupabaseClient } from "@supabase/supabase-js";
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

export function createSupabasePairingRepository(client: SupabaseClient): PairingRepository {
  return {
    async getMyChildren(parentId) {
      const { data, error } = await client
        .from("parent_child_links")
        .select("children(id, full_name, birth_date)")
        .eq("parent_id", parentId);
      if (error) throw error;
      return (data ?? []).map((row: any) => mapChild(row.children));
    },

    async createChild(parentId, input) {
      const { data, error } = await client
        .from("children")
        .insert({ full_name: input.fullName, birth_date: input.birthDate, created_by: parentId })
        .select()
        .single();
      if (error) throw error;
      return mapChild(data);
    },

    async updateChild(_parentId, childId, input: UpdateChildInput) {
      const { data, error } = await client
        .from("children")
        .update({ full_name: input.fullName, birth_date: input.birthDate })
        .eq("id", childId)
        .select()
        .single();
      if (error) throw error;
      return mapChild(data);
    },

    async getProfile(parentId) {
      const { data, error } = await client.from("profiles").select().eq("id", parentId).maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: userData } = await client.auth.getUser();
      const email = userData.user?.id === parentId ? (userData.user?.email ?? "") : "";
      return { id: data.id, fullName: data.full_name, email };
    },

    async upsertProfile(parentId, input: UpsertProfileInput) {
      const { data, error } = await client
        .from("profiles")
        .upsert({ id: parentId, full_name: input.fullName })
        .select()
        .single();
      if (error) throw error;

      const { data: userData } = await client.auth.getUser();
      return { id: data.id, fullName: data.full_name, email: userData.user?.email ?? "" };
    },

    async getInvitationByToken(token) {
      const { data, error } = await client
        .from("invitations")
        .select()
        .eq("token", token)
        .maybeSingle();
      if (error) throw error;
      return data ? mapInvitation(data) : null;
    },

    async listPendingInvitations(parentId, childId) {
      const { data, error } = await client
        .from("invitations")
        .select()
        .eq("child_id", childId)
        .eq("created_by", parentId)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).map(mapInvitation);
    },

    async createInvitation(parentId, input: CreateInvitationInput) {
      const { data, error } = await client
        .from("invitations")
        .insert({ child_id: input.childId, created_by: parentId })
        .select()
        .single();
      if (error) throw error;
      return mapInvitation(data);
    },

    async acceptInvitation(_parentId, input: AcceptInvitationInput) {
      const { data: childId, error } = await client.rpc("accept_invitation", {
        invitation_token: input.token,
      });
      if (error) throw error;
      const { data, error: childError } = await client
        .from("children")
        .select()
        .eq("id", childId)
        .single();
      if (childError) throw childError;
      return mapChild(data);
    },
  };
}

function mapChild(row: any): Child {
  return { id: row.id, fullName: row.full_name, birthDate: row.birth_date };
}

function mapInvitation(row: any): Invitation {
  return {
    id: row.id,
    token: row.token,
    childId: row.child_id,
    createdByParentId: row.created_by,
    status: row.status,
    expiresAt: row.expires_at,
  };
}
