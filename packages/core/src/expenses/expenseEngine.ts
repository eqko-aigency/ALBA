import type { Expense } from "../domain/entities";

/**
 * Cuánto le corresponde cubrir (reembolsar) a quien NO pagó un gasto —
 * usada tanto por getBalance() como por el export CSV, para que el
 * balance en pantalla y lo exportado nunca queden desalineados.
 *
 * Si el gasto tiene una contraoferta aceptada (counterAmountMxn no nulo),
 * ese monto manda directo, sin importar el % del reparto. Si no, se
 * calcula con el % confirmado (o 50/50 si nunca se confirmó ninguno).
 *
 * parentIds identifica a los dos miembros de la familia, en cualquier
 * orden — no asume cuál es "el caller".
 */
export function computeExpenseReimbursement(
  expense: Pick<Expense, "amountMxn" | "paidByParentId" | "counterAmountMxn">,
  split: { proposerSharePct: number; proposedByParentId: string } | null,
  parentIds: { a: string; b: string }
): number {
  if (expense.counterAmountMxn !== null) return expense.counterAmountMxn;

  const nonPayerId = expense.paidByParentId === parentIds.a ? parentIds.b : parentIds.a;
  const proposerPct = split?.proposerSharePct ?? 50;
  // Sin split confirmado, el 50/50 es simétrico — da igual a quién se
  // trate como "proponente" acá, nunca se usa ese valor en el cálculo.
  const proposerId = split?.proposedByParentId ?? nonPayerId;
  const nonPayerPct = nonPayerId === proposerId ? proposerPct : 100 - proposerPct;

  return expense.amountMxn * (nonPayerPct / 100);
}
