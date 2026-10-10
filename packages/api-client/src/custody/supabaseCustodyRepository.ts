import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustodyAgreement, CustodyEvent, CustodyEventType, CustodyRepository, CustodySlot } from "@alba/core";
import { createFamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseCustodyRepository(client: SupabaseClient): CustodyRepository {
  const getMyFamilyId = createFamilyIdResolver(client);

  async function getOrCreateAgreementRow(familyId: string): Promise<{ id: string; tolerance_minutes: number }> {
    const { data: existing, error: selectError } = await client
      .from("custody_agreements")
      .select("id, tolerance_minutes")
      .eq("family_id", familyId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return existing;

    const { data: created, error: insertError } = await client
      .from("custody_agreements")
      .insert({ family_id: familyId })
      .select("id, tolerance_minutes")
      .single();
    if (insertError) {
      // 23505 = unique_violation sobre custody_agreements_family_unique —
      // otra request ya creó el convenio de esta familia entre el select y
      // este insert (mismo criterio que supabaseChatRepository.createThread).
      if (insertError.code === "23505") {
        const { data: raceWinner, error: refetchError } = await client
          .from("custody_agreements")
          .select("id, tolerance_minutes")
          .eq("family_id", familyId)
          .single();
        if (refetchError) throw refetchError;
        return raceWinner;
      }
      throw insertError;
    }
    return created;
  }

  async function loadAgreement(familyId: string): Promise<CustodyAgreement> {
    const row = await getOrCreateAgreementRow(familyId);
    const { data: slotRows, error } = await client
      .from("custody_slots")
      .select()
      .eq("agreement_id", row.id)
      // Orden determinístico — la UI remueve slots por índice dentro del
      // arreglo ya ordenado, no por id (CustodySlot no tiene id propio en
      // el dominio, ver entities.ts).
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return {
      id: row.id,
      childId: "",
      toleranceMinutes: row.tolerance_minutes,
      slots: (slotRows ?? []).map(mapSlot),
    };
  }

  return {
    async getMyAgreement(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      return loadAgreement(familyId);
    },

    async upsertSlots(parentId, slots) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const row = await getOrCreateAgreementRow(familyId);

      // Reemplazo completo (borrar + reinsertar) en vez de diffear
      // altas/bajas/cambios — el form del convenio siempre reenvía la lista
      // completa, así que es más simple y suficiente para el MVP.
      const { error: deleteError } = await client.from("custody_slots").delete().eq("agreement_id", row.id);
      if (deleteError) throw deleteError;

      if (slots.length > 0) {
        const { error: insertError } = await client.from("custody_slots").insert(
          slots.map((s) => ({
            agreement_id: row.id,
            child_id: s.childId,
            parent_id: s.parentId,
            weekday: s.weekday,
            start_time: s.startTime,
            end_time: s.endTime,
          }))
        );
        if (insertError) throw insertError;
      }

      return loadAgreement(familyId);
    },

    async listEventsForWeek(parentId, weekStart) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const { data: childRows, error: childError } = await client.from("children").select("id").eq("family_id", familyId);
      if (childError) throw childError;
      const childIds = (childRows ?? []).map((c: any) => c.id);
      if (childIds.length === 0) return [];

      const start = new Date(`${weekStart}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const { data, error } = await client
        .from("custody_events")
        .select()
        .in("child_id", childIds)
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString());
      if (error) throw error;
      return (data ?? []).map(mapEvent);
    },

    async confirmCheckin(parentId, childId, scheduledAt) {
      return confirmEvent(client, parentId, childId, "checkin", scheduledAt);
    },

    async confirmCheckout(parentId, childId, scheduledAt) {
      return confirmEvent(client, parentId, childId, "checkout", scheduledAt);
    },
  };
}

/**
 * Insert/upsert directo siguiendo el mismo patrón que children/invitations/
 * chat (NO el RPC security definer de "families" — ver
 * 0008_get_or_create_my_family_rpc.sql: esa anomalía quedó aislada a esa
 * tabla específica, nunca se repitió en los demás inserts directos una vez
 * corregida la propagación de sesión en getRequestContext). Si en
 * producción este insert llegara a fallar con el mismo síntoma (RLS 42501 /
 * "auth_user: null" pese a sesión válida), el respaldo es mover esto a una
 * función RPC security definer análoga a get_or_create_my_family() que lea
 * auth.uid() del lado del servidor.
 */
async function confirmEvent(
  client: SupabaseClient,
  parentId: string,
  childId: string,
  type: CustodyEventType,
  scheduledAt: string
): Promise<CustodyEvent> {
  const { data, error } = await client
    .from("custody_events")
    .upsert(
      { child_id: childId, parent_id: parentId, type, scheduled_at: scheduledAt, confirmed_at: new Date().toISOString() },
      { onConflict: "child_id,parent_id,type,scheduled_at" }
    )
    .select()
    .single();
  if (error) throw error;
  return mapEvent(data);
}

function mapSlot(row: any): CustodySlot {
  return { childId: row.child_id, parentId: row.parent_id, weekday: row.weekday, startTime: row.start_time, endTime: row.end_time };
}

function mapEvent(row: any): CustodyEvent {
  return {
    id: row.id,
    childId: row.child_id,
    parentId: row.parent_id,
    type: row.type,
    scheduledAt: row.scheduled_at,
    confirmedAt: row.confirmed_at,
    location: row.location,
  };
}
