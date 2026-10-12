import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcceptInvitationInput,
  Child,
  Family,
  Invitation,
  PairingRepository,
  SetUsageModeInput,
  UpdateChildDetailsInput,
  UpdateChildInput,
  UpsertProfileInput,
} from "@alba/core";
import { createFamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabasePairingRepository(client: SupabaseClient): PairingRepository {
  const getMyFamilyId = createFamilyIdResolver(client);

  return {
    async getOrCreateMyFamily(_parentId) {
      // RPC security definer en vez de insert directo — ver migración 0008
      // para el porqué: el insert directo venía rechazado por RLS en
      // producción (auth_user: null) pese a sesión válida.
      const { data, error } = await client.rpc("get_or_create_my_family");
      if (error) throw error;
      return { id: data };
    },

    async getMyChildren(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client.from("children").select().eq("family_id", familyId);
      if (error) throw error;
      return (data ?? []).map(mapChild);
    },

    async createChild(parentId, input) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("children")
        .insert({ family_id: familyId, full_name: input.fullName, birth_date: input.birthDate })
        .select()
        .single();
      if (error) throw error;
      return mapChild(data);
    },

    async updateChild(parentId, childId, input: UpdateChildInput) {
      // RLS ya restringe el update a hijos de la familia del caller, pero
      // scopear también acá por family_id da defensa en profundidad (igual
      // que mockPairingRepository.updateChild) en vez de depender
      // únicamente de que la política de RLS esté bien.
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("children")
        .update({ full_name: input.fullName, birth_date: input.birthDate })
        .eq("id", childId)
        .eq("family_id", familyId)
        .select()
        .single();
      if (error) throw error;
      return mapChild(data);
    },

    async updateChildDetails(parentId, childId, input: UpdateChildDetailsInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("children")
        .update({
          contacts: input.contacts,
          therapist_name: input.therapistName,
          therapist_phone: input.therapistPhone,
          school_name: input.schoolName,
          school_contact: input.schoolContact,
          allergies: input.allergies,
          special_notes: input.specialNotes,
          sleep_routine: input.sleepRoutine,
        })
        .eq("id", childId)
        .eq("family_id", familyId)
        .select()
        .single();
      if (error) throw error;
      return mapChild(data);
    },

    async getProfile(parentId) {
      const { data, error } = await client.from("profiles").select().eq("id", parentId).maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // getSession() lee el JWT ya verificado localmente, sin pegarle de
      // nuevo al servidor de Auth — a diferencia de getCurrentParentId()
      // (repository.ts), acá la identidad del caller ya se validó río
      // arriba; esto solo necesita leer el email que ya trae la sesión.
      const { data: sessionData } = await client.auth.getSession();
      const email = sessionData.session?.user.id === parentId ? (sessionData.session?.user.email ?? "") : "";
      return { id: data.id, fullName: data.full_name, email, usageMode: data.usage_mode ?? null };
    },

    async upsertProfile(parentId, input: UpsertProfileInput) {
      const { data, error } = await client
        .from("profiles")
        .upsert({ id: parentId, full_name: input.fullName })
        .select()
        .single();
      if (error) throw error;

      const { data: sessionData } = await client.auth.getSession();
      return {
        id: data.id,
        fullName: data.full_name,
        email: sessionData.session?.user.email ?? "",
        usageMode: data.usage_mode ?? null,
      };
    },

    async setUsageMode(parentId, input: SetUsageModeInput) {
      const { data, error } = await client
        .from("profiles")
        .update({ usage_mode: input.usageMode })
        .eq("id", parentId)
        .select()
        .single();
      if (error) throw error;

      const { data: sessionData } = await client.auth.getSession();
      return {
        id: data.id,
        fullName: data.full_name,
        email: sessionData.session?.user.email ?? "",
        usageMode: data.usage_mode ?? null,
      };
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

    async listPendingInvitations(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client
        .from("invitations")
        .select()
        .eq("family_id", familyId)
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []).map(mapInvitation);
    },

    async createInvitation(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("invitations")
        .insert({ family_id: familyId, created_by: parentId })
        .select()
        .single();
      if (error) throw error;
      return mapInvitation(data);
    },

    async listFamilyMembers(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      // Embedding vía la FK family_members.parent_id -> profiles.id (misma
      // relación que ya usa family_members para RLS en 0001). Si en algún
      // ambiente el embed fallara, el fallback es dos queries separadas.
      const { data, error } = await client
        .from("family_members")
        .select("parent_id, profiles(full_name)")
        .eq("family_id", familyId);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.parent_id,
        fullName: row.profiles?.full_name ?? "Progenitor",
        email: "",
        usageMode: null,
      }));
    },

    async acceptInvitation(_parentId, input: AcceptInvitationInput): Promise<Family> {
      const { data: familyId, error } = await client.rpc("accept_invitation", {
        invitation_token: input.token,
      });
      if (error) throw error;
      return { id: familyId };
    },
  };
}

function mapChild(row: any): Child {
  return {
    id: row.id,
    familyId: row.family_id,
    fullName: row.full_name,
    birthDate: row.birth_date,
    contacts: row.contacts ?? [],
    therapistName: row.therapist_name ?? null,
    therapistPhone: row.therapist_phone ?? null,
    schoolName: row.school_name ?? null,
    schoolContact: row.school_contact ?? null,
    allergies: row.allergies ?? null,
    specialNotes: row.special_notes ?? null,
    sleepRoutine: row.sleep_routine ?? null,
  };
}

function mapInvitation(row: any): Invitation {
  return {
    id: row.id,
    token: row.token,
    familyId: row.family_id,
    createdByParentId: row.created_by,
    status: row.status,
    expiresAt: row.expires_at,
  };
}
