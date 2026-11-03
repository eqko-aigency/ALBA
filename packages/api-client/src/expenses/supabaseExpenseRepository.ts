// packages/api-client/src/expenses/supabaseExpenseRepository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeExpenseReimbursement,
  type Expense,
  type ExpenseCounterInput,
  type ExpenseRepository,
  type ExpenseSettlement,
  type ExpenseSettlementInput,
  type ExpenseSplit,
} from "@alba/core";
import { createFamilyIdResolver, type FamilyIdResolver } from "../family/resolveFamilyId";

export function createSupabaseExpenseRepository(
  client: SupabaseClient,
  familyIdResolver?: FamilyIdResolver
): ExpenseRepository {
  const getMyFamilyId = familyIdResolver ?? createFamilyIdResolver(client);

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
      if (!otherParentId) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const childIds = await getFamilyChildIds(familyId);
      if (childIds.length === 0) return { otherParentId, amountMxnOwedByCaller: 0 };

      const { data: settlementRow, error: settlementError } = await client
        .from("family_expense_settlements")
        .select("confirmed_at")
        .eq("family_id", familyId)
        .not("confirmed_at", "is", null)
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (settlementError) throw settlementError;
      const cutoff: string | null = settlementRow?.confirmed_at ?? null;

      const { data: splitRow, error: splitError } = await client
        .from("family_expense_splits")
        .select("proposer_share_pct, proposed_by_parent_id")
        .eq("family_id", familyId)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (splitError) throw splitError;
      const confirmedSplit = splitRow
        ? { proposerSharePct: splitRow.proposer_share_pct, proposedByParentId: splitRow.proposed_by_parent_id }
        : null;

      let query = client
        .from("expenses")
        .select("paid_by_parent_id, amount_mxn, counter_amount_mxn")
        .in("child_id", childIds)
        .eq("status", "approved");
      if (cutoff) query = query.gt("created_at", cutoff);
      const { data: approved, error: expensesError } = await query;
      if (expensesError) throw expensesError;

      let amountMxnOwedByCaller = 0;
      for (const row of approved ?? []) {
        const expense = {
          amountMxn: Number(row.amount_mxn),
          paidByParentId: row.paid_by_parent_id,
          counterAmountMxn: row.counter_amount_mxn !== null ? Number(row.counter_amount_mxn) : null,
        };
        const reimbursement = computeExpenseReimbursement(expense, confirmedSplit, { a: parentId, b: otherParentId });
        if (expense.paidByParentId === otherParentId) amountMxnOwedByCaller += reimbursement;
        else amountMxnOwedByCaller -= reimbursement;
      }

      return { otherParentId, amountMxnOwedByCaller };
    },

    async getExpenseSplit(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;

      const { data: pending, error: pendingError } = await client
        .from("family_expense_splits")
        .select()
        .eq("family_id", familyId)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingError) throw pendingError;
      if (pending) return mapSplit(pending);

      const { data: confirmed, error: confirmedError } = await client
        .from("family_expense_splits")
        .select()
        .eq("family_id", familyId)
        .eq("status", "confirmed")
        .order("confirmed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (confirmedError) throw confirmedError;
      return confirmed ? mapSplit(confirmed) : null;
    },

    async proposeExpenseSplit(parentId, proposerSharePct) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) {
        throw new Error("No perteneces a ninguna familia todavía — empareja al otro progenitor desde tu Perfil.");
      }
      // A propósito NO se atrapa el 23505 (unique_violation) del índice
      // parcial "una pendiente a la vez" — el puerto dice explícitamente
      // "falla si ya hay una propuesta pendiente", a diferencia de
      // registerPayment en Pensión, que sí es idempotente.
      const { data, error } = await client
        .from("family_expense_splits")
        .insert({
          family_id: familyId,
          proposed_by_parent_id: parentId,
          proposer_share_pct: proposerSharePct,
        })
        .select()
        .single();
      if (error) throw error;
      return mapSplit(data);
    },

    async confirmExpenseSplit(_parentId, splitId) {
      // SECURITY DEFINER — ver confirm_expense_split() en
      // 0034_reparto_gastos.sql.
      const { data, error } = await client.rpc("confirm_expense_split", { p_split_id: splitId });
      if (error) throw error;
      return mapSplit(data);
    },

    async rejectExpenseSplit(_parentId, splitId) {
      const { error } = await client.from("family_expense_splits").delete().eq("id", splitId);
      if (error) throw error;
    },

    async proposeExpenseCounter(parentId, expenseId, input: ExpenseCounterInput) {
      const { data: existing, error: fetchError } = await client
        .from("expenses")
        .select("paid_by_parent_id, status")
        .eq("id", expenseId)
        .single();
      if (fetchError) throw fetchError;
      if (existing.paid_by_parent_id === parentId) {
        throw new Error("no puedes contraofertar tu propio gasto");
      }
      if (existing.status !== "pending_approval") {
        throw new Error("este gasto ya no está pendiente de aprobación");
      }

      const { data, error } = await client
        .from("expenses")
        .update({
          status: "countered",
          counter_amount_mxn: input.counterAmountMxn,
          counter_comment: input.counterComment,
          countered_by_parent_id: parentId,
        })
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      return mapExpense(data);
    },

    async resolveExpenseCounter(_parentId, expenseId, accept) {
      // SECURITY DEFINER — ver resolve_expense_counter() en
      // 0035_contraoferta_gastos.sql.
      const { data, error } = await client.rpc("resolve_expense_counter", {
        p_expense_id: expenseId,
        p_accept: accept,
      });
      if (error) throw error;
      return mapExpense(data);
    },

    async getLatestExpenseSettlement(parentId) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) return null;
      const { data, error } = await client
        .from("family_expense_settlements")
        .select()
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? mapSettlement(data) : null;
    },

    async registerExpenseSettlement(parentId, input: ExpenseSettlementInput) {
      const familyId = await getMyFamilyId(parentId);
      if (!familyId) throw new Error("el progenitor no pertenece a ninguna familia todavía");
      const { data, error } = await client
        .from("family_expense_settlements")
        .insert({ family_id: familyId, paid_by_parent_id: parentId, amount_mxn: input.amountMxn })
        .select()
        .single();
      if (error) throw error;
      return mapSettlement(data);
    },

    async confirmExpenseSettlement(_parentId, settlementId) {
      // SECURITY DEFINER — ver confirm_expense_settlement() en
      // 0036_liquidar_saldo_gastos.sql.
      const { data, error } = await client.rpc("confirm_expense_settlement", {
        p_settlement_id: settlementId,
      });
      if (error) throw error;
      return mapSettlement(data);
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
    counterAmountMxn: row.counter_amount_mxn !== null ? Number(row.counter_amount_mxn) : null,
    counterComment: row.counter_comment ?? null,
    counteredByParentId: row.countered_by_parent_id ?? null,
  };
}

function mapSplit(row: any): ExpenseSplit {
  return {
    id: row.id,
    familyId: row.family_id,
    proposedByParentId: row.proposed_by_parent_id,
    proposerSharePct: row.proposer_share_pct,
    status: row.status,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    createdAt: row.created_at,
  };
}

function mapSettlement(row: any): ExpenseSettlement {
  return {
    id: row.id,
    familyId: row.family_id,
    paidByParentId: row.paid_by_parent_id,
    amountMxn: Number(row.amount_mxn),
    createdAt: row.created_at,
    confirmedByParentId: row.confirmed_by_parent_id ?? null,
    confirmedAt: row.confirmed_at ?? null,
  };
}
