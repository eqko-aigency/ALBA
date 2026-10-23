import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerbalAgreement, VerbalAgreementInput, VerbalAgreementRepository } from "@alba/core";
import { createFamilyIdResolver, type FamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseVerbalAgreementRepository(
  client: SupabaseClient,
  familyIdResolver?: FamilyIdResolver
): VerbalAgreementRepository {
  const getMyFamilyId = familyIdResolver ?? createFamilyIdResolver(client);

  return {
    async listVerbalAgreements(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client
        .from("verbal_agreements")
        .select()
        .eq("family_id", familyId)
        .order("agreed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapAgreement);
    },

    async createVerbalAgreement(parentId, input: VerbalAgreementInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) {
        throw new Error("No perteneces a ninguna familia todavía — empareja al otro progenitor desde tu Perfil.");
      }
      const { data, error } = await client
        .from("verbal_agreements")
        .insert({
          family_id: familyId,
          created_by_parent_id: parentId,
          child_id: input.childId,
          description: input.description,
          agreed_at: input.agreedAt,
        })
        .select()
        .single();
      if (error) throw error;
      return mapAgreement(data);
    },

    async confirmVerbalAgreement(_parentId, agreementId) {
      // SECURITY DEFINER (igual criterio que anchor_pending_documents en
      // 0011_boveda.sql): verbal_agreements no tiene policy de UPDATE
      // directa — "confirmar" es la única escritura posterior permitida, y
      // esta función la acota a quien NO lo creó y solo si no estaba ya
      // confirmado (ver 0015_acuerdos_verbales.sql).
      const { data, error } = await client.rpc("confirm_verbal_agreement", {
        p_agreement_id: agreementId,
      });
      if (error) throw error;
      return mapAgreement(data);
    },
  };
}

function mapAgreement(row: any): VerbalAgreement {
  return {
    id: row.id,
    familyId: row.family_id,
    createdByParentId: row.created_by_parent_id,
    childId: row.child_id ?? null,
    description: row.description,
    agreedAt: row.agreed_at,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    confirmedAt: row.confirmed_at ?? null,
    createdAt: row.created_at,
  };
}
