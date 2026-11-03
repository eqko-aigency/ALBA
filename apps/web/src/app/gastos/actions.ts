"use server";

import { revalidatePath } from "next/cache";
import {
  expenseCounterInputSchema,
  expenseInputSchema,
  expenseSettlementInputSchema,
  expenseSplitInputSchema,
} from "@alba/core";
import { getRequestContext, uploadReceiptFile } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/**
 * Comprobante: si se adjuntó un archivo (imagen/PDF) se sube a Supabase
 * Storage (bucket "comprobantes", ver 0010_gastos.sql) y esa URL manda. En
 * modo demo, o si no se adjuntó archivo, se usa el campo manual de texto
 * "receiptUrl" como fallback — así el flujo de crear/aprobar/rechazar
 * gastos funciona sólido en ambos modos, con o sin Storage real (ver nota
 * de diseño en el reporte de la feature).
 */
export async function createExpenseAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const manualReceiptUrl = String(formData.get("receiptUrlManual") ?? "").trim();
  const file = formData.get("receipt");

  let receiptUrl: string | null = manualReceiptUrl.length > 0 ? manualReceiptUrl : null;
  if (file instanceof File && file.size > 0) {
    const uploadedUrl = await uploadReceiptFile(file);
    if (uploadedUrl) receiptUrl = uploadedUrl;
  }

  const input = expenseInputSchema.parse({
    childId: formData.get("childId"),
    amountMxn: Number(formData.get("amountMxn")),
    description: formData.get("description"),
    receiptUrl,
  });

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.createExpense(parentId, input);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nuevo gasto por aprobar",
    body: `${expense.description} — ${MXN.format(expense.amountMxn)}`,
    url: "/gastos",
  });
}

export async function updateExpenseStatusAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const expenseId = String(formData.get("expenseId"));
  const status = formData.get("status") === "approved" ? "approved" : "rejected";

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.updateExpenseStatus(parentId, expenseId, status);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: status === "approved" ? "Gasto aprobado" : "Gasto rechazado",
    body: `${expense.description} — ${MXN.format(expense.amountMxn)}`,
    url: "/gastos",
  });
}

export async function proposeExpenseSplitAction(formData: FormData) {
  const input = expenseSplitInputSchema.parse({
    proposerSharePct: Number(formData.get("proposerSharePct")),
  });
  const as = String(formData.get("as") ?? "");
  const { expenses, pairing, parentId } = await getRequestContext(as);
  await expenses.proposeExpenseSplit(parentId, input.proposerSharePct);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Nueva propuesta de reparto de gastos",
    body: `Propone cubrir ${input.proposerSharePct}% de los gastos`,
    url: "/gastos",
  });
}

export async function confirmExpenseSplitAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const splitId = String(formData.get("splitId") ?? "");
  const { expenses, pairing, parentId } = await getRequestContext(as);
  await expenses.confirmExpenseSplit(parentId, splitId);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Reparto de gastos confirmado",
    body: "Ya pueden ver el nuevo reparto en Gastos",
    url: "/gastos",
  });
}

export async function rejectExpenseSplitAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const splitId = String(formData.get("splitId") ?? "");
  const { expenses, parentId } = await getRequestContext(as);
  await expenses.rejectExpenseSplit(parentId, splitId);
  revalidatePath("/gastos");
}

export async function proposeExpenseCounterAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const input = expenseCounterInputSchema.parse({
    counterAmountMxn: Number(formData.get("counterAmountMxn")),
    counterComment: formData.get("counterComment"),
  });

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.proposeExpenseCounter(parentId, expenseId, input);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Contraoferta en un gasto",
    body: `${expense.description} — ofrece cubrir ${MXN.format(input.counterAmountMxn)}`,
    url: "/gastos",
  });
}

export async function resolveExpenseCounterAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  const accept = formData.get("accept") === "true";

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const expense = await expenses.resolveExpenseCounter(parentId, expenseId, accept);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: accept ? "Contraoferta aceptada" : "Contraoferta rechazada",
    body: expense.description,
    url: "/gastos",
  });
}

export async function registerExpenseSettlementAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const input = expenseSettlementInputSchema.parse({ amountMxn: Number(formData.get("amountMxn")) });

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const settlement = await expenses.registerExpenseSettlement(parentId, input);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Pago de gastos registrado",
    body: `Marcó que te pagó ${MXN.format(settlement.amountMxn)}`,
    url: "/gastos",
  });
}

export async function confirmExpenseSettlementAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const settlementId = String(formData.get("settlementId") ?? "");

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const settlement = await expenses.confirmExpenseSettlement(parentId, settlementId);

  revalidatePath("/gastos");

  const family = await pairing.getOrCreateMyFamily(parentId);
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Confirmaron tu pago de gastos",
    body: MXN.format(settlement.amountMxn),
    url: "/gastos",
  });
}
