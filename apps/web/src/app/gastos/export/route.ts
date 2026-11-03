// apps/web/src/app/gastos/export/route.ts
import type { NextRequest } from "next/server";
import { computeExpenseReimbursement } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

function expensePeriod(createdAt: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(createdAt));
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export async function GET(request: NextRequest) {
  const as = request.nextUrl.searchParams.get("as") ?? "";
  const period = request.nextUrl.searchParams.get("period") ?? "";
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return new Response("period inválido", { status: 400 });
  }

  const { expenses, pairing, parentId } = await getRequestContext(as);
  const [expenseList, children, familyMembers, split] = await Promise.all([
    expenses.listExpenses(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    expenses.getExpenseSplit(parentId),
  ]);
  const otherParent = familyMembers.find((p) => p.id !== parentId) ?? null;
  const confirmedSplit = split?.status === "confirmed" ? split : null;

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Yo" : (familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor");

  const rows = expenseList.filter((e) => e.status === "approved" && expensePeriod(e.createdAt) === period);

  const csvEscape = (v: string) => {
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = ["Fecha,Hijo,Descripción,Monto,Pagó,Reembolso"];
  for (const e of rows) {
    const reimbursement = otherParent
      ? computeExpenseReimbursement(e, confirmedSplit, { a: parentId, b: otherParent.id })
      : 0;
    lines.push(
      [
        e.createdAt.slice(0, 10),
        csvEscape(childName(e.childId)),
        csvEscape(e.description),
        e.amountMxn.toFixed(2),
        csvEscape(parentName(e.paidByParentId)),
        reimbursement.toFixed(2),
      ].join(",")
    );
  }

  lines.push("");
  lines.push("Totales por hijo");
  const totalsByChild = new Map<string, number>();
  for (const e of rows) {
    totalsByChild.set(e.childId, (totalsByChild.get(e.childId) ?? 0) + e.amountMxn);
  }
  for (const [childId, total] of totalsByChild) {
    lines.push(`${csvEscape(childName(childId))},,,,,${total.toFixed(2)}`);
  }

  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${period}.csv"`,
    },
  });
}
