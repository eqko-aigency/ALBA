"use server";

import { revalidatePath } from "next/cache";
import { expenseInputSchema } from "@alba/core";
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
