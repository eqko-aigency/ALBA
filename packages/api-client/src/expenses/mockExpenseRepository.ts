// packages/api-client/src/expenses/mockExpenseRepository.ts
import {
  computeExpenseReimbursement,
  type Expense,
  type ExpenseCounterInput,
  type ExpenseRepository,
  type ExpenseSettlement,
  type ExpenseSettlementInput,
  type ExpenseSplit,
  type PairingRepository,
} from "@alba/core";

/**
 * Implementación en memoria de Gastos — mismo patrón que
 * mockCustodyRepository: depende de PairingRepository para resolver a qué
 * familia/hijos pertenece cada progenitor, así todos los repos mock
 * comparten la misma noción de "familia" sin duplicar ese estado.
 */
export function createMockExpenseRepository(pairingRepository: PairingRepository): ExpenseRepository {
  const expenses = new Map<string, Expense>();
  const splits = new Map<string, ExpenseSplit>();
  const settlements = new Map<string, ExpenseSettlement>();

  async function getFamilyChildIds(parentId: string): Promise<Set<string>> {
    const children = await pairingRepository.getMyChildren(parentId);
    return new Set(children.map((c) => c.id));
  }

  async function getFamilyId(parentId: string): Promise<string> {
    const family = await pairingRepository.getOrCreateMyFamily(parentId);
    return family.id;
  }

  return {
    async listExpenses(parentId) {
      const childIds = await getFamilyChildIds(parentId);
      return [...expenses.values()]
        .filter((e) => childIds.has(e.childId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    async createExpense(parentId, input) {
      const expense: Expense = {
        id: crypto.randomUUID(),
        childId: input.childId,
        paidByParentId: parentId,
        amountMxn: input.amountMxn,
        description: input.description,
        receiptUrl: input.receiptUrl,
        status: "pending_approval",
        createdAt: new Date().toISOString(),
        counterAmountMxn: null,
        counterComment: null,
        counteredByParentId: null,
      };
      expenses.set(expense.id, expense);
      return expense;
    },

    async updateExpenseStatus(parentId, expenseId, status) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      // Defensa en profundidad — misma regla que la política de UPDATE de
      // 0010_gastos.sql: el pagador no puede aprobar ni rechazar su propio
      // gasto.
      if (expense.paidByParentId === parentId) {
        throw new Error("no puedes aprobar o rechazar tu propio gasto");
      }
      expense.status = status;
      return expense;
    },

    async getBalance(parentId) {
      const childIds = await getFamilyChildIds(parentId);
      const familyMembers = await pairingRepository.listFamilyMembers(parentId);
      const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;
      if (!otherParent) return { otherParentId: null, amountMxnOwedByCaller: 0 };

      const familyId = await getFamilyId(parentId);

      const latestConfirmedSettlement = [...settlements.values()]
        .filter((s) => s.familyId === familyId && s.confirmedAt)
        .sort((a, b) => new Date(b.confirmedAt!).getTime() - new Date(a.confirmedAt!).getTime())[0];
      const cutoff = latestConfirmedSettlement?.confirmedAt ?? null;

      const confirmedSplitRow = [...splits.values()]
        .filter((s) => s.familyId === familyId && s.status === "confirmed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const confirmedSplit = confirmedSplitRow
        ? { proposerSharePct: confirmedSplitRow.proposerSharePct, proposedByParentId: confirmedSplitRow.proposedByParentId }
        : null;

      const approved = [...expenses.values()].filter(
        (e) => childIds.has(e.childId) && e.status === "approved" && (!cutoff || e.createdAt > cutoff)
      );

      let amountMxnOwedByCaller = 0;
      for (const e of approved) {
        const reimbursement = computeExpenseReimbursement(e, confirmedSplit, { a: parentId, b: otherParent.id });
        if (e.paidByParentId === otherParent.id) amountMxnOwedByCaller += reimbursement;
        else amountMxnOwedByCaller -= reimbursement;
      }

      return { otherParentId: otherParent.id, amountMxnOwedByCaller };
    },

    async getExpenseSplit(parentId) {
      const familyId = await getFamilyId(parentId);
      const mine = [...splits.values()].filter((s) => s.familyId === familyId);
      const pending = mine.find((s) => s.status === "pending");
      if (pending) return pending;
      const confirmed = mine
        .filter((s) => s.status === "confirmed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      return confirmed ?? null;
    },

    async proposeExpenseSplit(parentId, proposerSharePct) {
      const familyId = await getFamilyId(parentId);
      const alreadyPending = [...splits.values()].some((s) => s.familyId === familyId && s.status === "pending");
      if (alreadyPending) throw new Error("ya hay una propuesta de reparto pendiente");

      const split: ExpenseSplit = {
        id: crypto.randomUUID(),
        familyId,
        proposedByParentId: parentId,
        proposerSharePct,
        status: "pending",
        confirmedByParentId: null,
        createdAt: new Date().toISOString(),
      };
      splits.set(split.id, split);
      return split;
    },

    async confirmExpenseSplit(parentId, splitId) {
      const split = splits.get(splitId);
      if (!split) throw new Error("propuesta no encontrada");
      if (split.proposedByParentId === parentId) {
        throw new Error("quien propuso el reparto no puede confirmarlo");
      }
      if (split.status === "pending") {
        split.status = "confirmed";
        split.confirmedByParentId = parentId;
      }
      return split;
    },

    async rejectExpenseSplit(parentId, splitId) {
      const split = splits.get(splitId);
      if (!split) return;
      if (split.proposedByParentId === parentId) {
        throw new Error("quien propuso el reparto no puede rechazarlo");
      }
      if (split.status === "pending") splits.delete(splitId);
    },

    async proposeExpenseCounter(parentId, expenseId, input: ExpenseCounterInput) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      if (expense.paidByParentId === parentId) {
        throw new Error("no puedes contraofertar tu propio gasto");
      }
      if (expense.status !== "pending_approval") {
        throw new Error("este gasto ya no está pendiente de aprobación");
      }
      expense.status = "countered";
      expense.counterAmountMxn = input.counterAmountMxn;
      expense.counterComment = input.counterComment;
      expense.counteredByParentId = parentId;
      return expense;
    },

    async resolveExpenseCounter(parentId, expenseId, accept) {
      const expense = expenses.get(expenseId);
      if (!expense) throw new Error("gasto no encontrado");
      if (expense.paidByParentId !== parentId) {
        throw new Error("solo quien pagó el gasto puede resolver la contraoferta");
      }
      if (expense.status !== "countered") {
        throw new Error("este gasto no tiene una contraoferta pendiente");
      }
      expense.status = accept ? "approved" : "rejected";
      return expense;
    },

    async getLatestExpenseSettlement(parentId) {
      const familyId = await getFamilyId(parentId);
      const mine = [...settlements.values()]
        .filter((s) => s.familyId === familyId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return mine[0] ?? null;
    },

    async registerExpenseSettlement(parentId, input: ExpenseSettlementInput) {
      const familyId = await getFamilyId(parentId);
      const settlement: ExpenseSettlement = {
        id: crypto.randomUUID(),
        familyId,
        paidByParentId: parentId,
        amountMxn: input.amountMxn,
        createdAt: new Date().toISOString(),
        confirmedByParentId: null,
        confirmedAt: null,
      };
      settlements.set(settlement.id, settlement);
      return settlement;
    },

    async confirmExpenseSettlement(parentId, settlementId) {
      const settlement = settlements.get(settlementId);
      if (!settlement) throw new Error("liquidación no encontrada");
      if (settlement.paidByParentId === parentId) {
        throw new Error("quien registró el pago no puede confirmarlo");
      }
      if (!settlement.confirmedAt) {
        settlement.confirmedByParentId = parentId;
        settlement.confirmedAt = new Date().toISOString();
      }
      return settlement;
    },
  };
}
