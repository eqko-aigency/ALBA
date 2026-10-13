import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PensionPayment,
  PensionPaymentInput,
  PensionRepository,
  PensionSettings,
  PensionSettingsInput,
} from "@alba/core";
import { createFamilyIdResolver, type FamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabasePensionRepository(
  client: SupabaseClient,
  familyIdResolver?: FamilyIdResolver
): PensionRepository {
  const getMyFamilyId = familyIdResolver ?? createFamilyIdResolver(client);

  return {
    async getSettings(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;
      const { data, error } = await client
        .from("pension_settings")
        .select()
        .eq("family_id", familyId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapSettings(data) : null;
    },

    async upsertSettings(parentId, input: PensionSettingsInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) {
        throw new Error("No perteneces a ninguna familia todavía — empareja al otro progenitor en /registro.");
      }
      const { data, error } = await client
        .from("pension_settings")
        .upsert(
          {
            family_id: familyId,
            payer_parent_id: input.payerParentId,
            amount_mxn: input.amountMxn,
            due_day: input.dueDay,
          },
          { onConflict: "family_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return mapSettings(data);
    },

    async listPayments(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data, error } = await client
        .from("pension_payments")
        .select()
        .eq("family_id", familyId)
        .order("period", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapPayment);
    },

    async registerPayment(parentId, input: PensionPaymentInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");

      const { data: settings, error: settingsError } = await client
        .from("pension_settings")
        .select("amount_mxn")
        .eq("family_id", familyId)
        .maybeSingle();
      if (settingsError) throw settingsError;
      if (!settings) throw new Error("Configura el monto y día de vencimiento antes de registrar un pago.");

      const { data, error } = await client
        .from("pension_payments")
        .insert({
          family_id: familyId,
          period: input.period,
          amount_mxn: settings.amount_mxn,
          paid_by_parent_id: parentId,
        })
        .select()
        .single();
      if (error) {
        // 23505 = unique_violation (family_id, period) — ya se había
        // registrado el pago de este período; devolver el existente en vez
        // de romper, mismo criterio que createThread en supabaseChatRepository.
        if (error.code === "23505") {
          const { data: existing, error: fetchError } = await client
            .from("pension_payments")
            .select()
            .eq("family_id", familyId)
            .eq("period", input.period)
            .single();
          if (fetchError) throw fetchError;
          return mapPayment(existing);
        }
        throw error;
      }
      return mapPayment(data);
    },

    async confirmPayment(_parentId, paymentId) {
      // SECURITY DEFINER (mismo criterio que confirm_verbal_agreement en
      // 0015_acuerdos_verbales.sql): pension_payments no tiene policy de
      // UPDATE directa — confirmar es la única escritura posterior
      // permitida, acotada a quien NO pagó y solo si no estaba ya
      // confirmado (ver 0016_pension.sql).
      const { data, error } = await client.rpc("confirm_pension_payment", {
        p_payment_id: paymentId,
      });
      if (error) throw error;
      return mapPayment(data);
    },
  };
}

function mapSettings(row: any): PensionSettings {
  return {
    id: row.id,
    familyId: row.family_id,
    payerParentId: row.payer_parent_id,
    amountMxn: Number(row.amount_mxn),
    dueDay: row.due_day,
  };
}

function mapPayment(row: any): PensionPayment {
  return {
    id: row.id,
    familyId: row.family_id,
    period: row.period,
    amountMxn: Number(row.amount_mxn),
    paidByParentId: row.paid_by_parent_id,
    paidAt: row.paid_at,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    confirmedAt: row.confirmed_at ?? null,
    createdAt: row.created_at,
  };
}
