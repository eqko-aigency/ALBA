import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExpenseReimbursement } from "./expenseEngine";

const PARENT_A = "11111111-1111-1111-1111-111111111111";
const PARENT_B = "22222222-2222-2222-2222-222222222222";

test("computeExpenseReimbursement sin split confirmado usa 50/50", () => {
  const expense = { amountMxn: 600, paidByParentId: PARENT_A, counterAmountMxn: null };
  const reimbursement = computeExpenseReimbursement(expense, null, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 300);
});

test("computeExpenseReimbursement con split confirmado asimétrico", () => {
  // PARENT_A propuso cubrir 60% → PARENT_B (quien no pagó este gasto) cubre 40%.
  const expense = { amountMxn: 1000, paidByParentId: PARENT_A, counterAmountMxn: null };
  const split = { proposerSharePct: 60, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 400);
});

test("computeExpenseReimbursement con split confirmado, el proponente paga el gasto", () => {
  // PARENT_B pagó este gasto, así que el reembolso lo cubre PARENT_A (el
  // proponente, 60%) — no PARENT_B.
  const expense = { amountMxn: 1000, paidByParentId: PARENT_B, counterAmountMxn: null };
  const split = { proposerSharePct: 60, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 600);
});

test("computeExpenseReimbursement con contraoferta aceptada ignora el % del split", () => {
  const expense = { amountMxn: 600, paidByParentId: PARENT_A, counterAmountMxn: 150 };
  const split = { proposerSharePct: 70, proposedByParentId: PARENT_A };
  const reimbursement = computeExpenseReimbursement(expense, split, { a: PARENT_A, b: PARENT_B });
  assert.equal(reimbursement, 150);
});
