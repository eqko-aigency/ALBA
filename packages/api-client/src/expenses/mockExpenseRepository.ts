import type { Expense, ExpenseRepository, PairingRepository } from "@alba/core";

/**
 * Implementación en memoria de Gastos — mismo patrón que
 * mockCustodyRepository: depende de PairingRepository para resolver a qué
 * familia/hijos pertenece cada progenitor, así todos los repos mock
 * comparten la misma noción de "familia" sin duplicar ese estado.
 */
export function createMockExpenseRepository(pairingRepository: PairingRepository): ExpenseRepository {
  const expenses = new Map<string, Expense>();

  async function getFamilyChildIds(parentId: string): Promise<Set<string>> {
    const children = await pairingRepository.getMyChildren(parentId);
    return new Set(children.map((c) => c.id));
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

      const approved = [...expenses.values()].filter((e) => childIds.has(e.childId) && e.status === "approved");
      const paidByCaller = approved
        .filter((e) => e.paidByParentId === parentId)
        .reduce((sum, e) => sum + e.amountMxn, 0);
      const paidByOther = otherParent
        ? approved.filter((e) => e.paidByParentId === otherParent.id).reduce((sum, e) => sum + e.amountMxn, 0)
        : 0;

      return {
        otherParentId: otherParent?.id ?? null,
        amountMxnOwedByCaller: otherParent ? (paidByOther - paidByCaller) / 2 : 0,
      };
    },
  };
}
