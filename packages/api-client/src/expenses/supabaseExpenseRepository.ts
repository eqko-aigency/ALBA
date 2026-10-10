import type { SupabaseClient } from "@supabase/supabase-js";
import type { Expense, ExpenseRepository } from "@alba/core";
import { createFamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseExpenseRepository(client: SupabaseClient): ExpenseRepository {
  const getMyFamilyId = createFamilyIdResolver(client);

  async function getFamilyChildIds(familyId: string): Promise<string[]> {
    const { data, error } = await client.from("children").select("id").eq("family_id", familyId);
    if (error) throw error;
    return (data ?? []).map((c: any) => c.id);
  }

  return {
    async listExpenses(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return [];
      const childIds = await getFamilyChildIds(familyId);
      if (childIds.length === 0) return [];
      const { data, error } = await client
        .from("expenses")
        .select()
        .in("child_id", childIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapExpense);
    },

    async createExpense(parentId, input) {
      // Insert directo siguiendo el patrón normal de RLS (igual que
      // children/invitations/chat/custody_events) — NO el RPC security
      // definer que sí hizo falta para "families" (ver 0008_get_or_create_
      // my_family_rpc.sql: esa anomalía nunca se repitió en otros inserts
      // directos una vez corregida la propagación de sesión en
      // getRequestContext). Si en producción este insert llegara a fallar
      // con el mismo síntoma (RLS 42501 / "auth_user: null" pese a sesión
      // válida), el respaldo es mover esto a una función RPC security
      // definer análoga a get_or_create_my_family().
      const { data, error } = await client
        .from("expenses")
        .insert({
          child_id: input.childId,
          paid_by_parent_id: parentId,
          amount_mxn: input.amountMxn,
          description: input.description,
          receipt_url: input.receiptUrl,
        })
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async updateExpenseStatus(parentId, expenseId, status) {
      // Defensa en profundidad — RLS ya impide que el pagador apruebe o
      // rechace su propio gasto (0010_gastos.sql), pero se verifica también
      // acá, mismo criterio que updateChild en supabasePairingRepository.ts.
      const { data: existing, error: fetchError } = await client
        .from("expenses")
        .select("paid_by_parent_id")
        .eq("id", expenseId)
        .single();
      if (fetchError) throw fetchError;
      if (existing.paid_by_parent_id === parentId) {
        throw new Error("no puedes aprobar o rechazar tu propio gasto");
      }

      const { data, error } = await client
        .from("expenses")
        .update({ status })
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async getBalance(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const { data: members, error: membersError } = await client
        .from("family_members")
        .select("parent_id")
        .eq("family_id", familyId);
      if (membersError) throw membersError;
      const otherParentId: string | null =
        (members ?? []).map((m: any) => m.parent_id).find((id: string) => id !== parentId) ?? null;

      const childIds = await getFamilyChildIds(familyId);
      if (childIds.length === 0 || !otherParentId) {
        return { otherParentId, amountMxnOwedByCaller: 0 };
      }

      const { data: approved, error: expensesError } = await client
        .from("expenses")
        .select("paid_by_parent_id, amount_mxn")
        .in("child_id", childIds)
        .eq("status", "approved");
      if (expensesError) throw expensesError;

      const paidByCaller = (approved ?? [])
        .filter((e: any) => e.paid_by_parent_id === parentId)
        .reduce((sum: number, e: any) => sum + Number(e.amount_mxn), 0);
      const paidByOther = (approved ?? [])
        .filter((e: any) => e.paid_by_parent_id === otherParentId)
        .reduce((sum: number, e: any) => sum + Number(e.amount_mxn), 0);

      return { otherParentId, amountMxnOwedByCaller: (paidByOther - paidByCaller) / 2 };
    },
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    childId: row.child_id,
    paidByParentId: row.paid_by_parent_id,
    amountMxn: Number(row.amount_mxn),
    description: row.description,
    receiptUrl: row.receipt_url,
    status: row.status,
    createdAt: row.created_at,
  };
}
