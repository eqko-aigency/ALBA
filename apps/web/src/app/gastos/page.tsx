import Link from "next/link";
import type { Expense } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { createExpenseAction, updateExpenseStatusAction } from "./actions";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const STATUS_LABEL: Record<Expense["status"], string> = {
  pending_approval: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  countered: "Contrapropuesta",
};

const STATUS_CLASS: Record<Expense["status"], string> = {
  pending_approval: "border border-orange bg-dawn text-ink",
  approved: "bg-success/20 text-ink",
  rejected: "bg-danger/20 text-ink",
  countered: "bg-purple/20 text-ink",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, expenses, parentId } = await getRequestContext(as);

  const [expenseList, children, familyMembers, balance] = await Promise.all([
    expenses.listExpenses(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    expenses.getBalance(parentId),
  ]);

  const childName = (childId: string) => children.find((c) => c.id === childId)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";
  const otherParentName = balance.otherParentId ? parentName(balance.otherParentId) : null;

  // Redondeo de centavos — evita mostrar "Están a mano" como "$0.00 de
  // diferencia" por errores de punto flotante al dividir /2.
  const owedRounded = Math.round(balance.amountMxnOwedByCaller * 100) / 100;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/gastos" : "/gastos?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Gastos</h1>
      <p className="mt-2 text-ink-soft">Registra gastos, aprueba los del otro progenitor y lleva el balance.</p>

      <section className="mt-6 rounded-xl border border-subtle bg-card p-5 text-center shadow-ambient">
        {!otherParentName ? (
          <p className="text-sm text-ink-soft">
            Empareja al otro progenitor (en /registro) para poder calcular el balance de gastos.
          </p>
        ) : owedRounded > 0 ? (
          <p className="text-lg font-semibold text-ink">
            Le debes a {otherParentName} <span className="text-danger">{MXN.format(owedRounded)}</span>
          </p>
        ) : owedRounded < 0 ? (
          <p className="text-lg font-semibold text-ink">
            {otherParentName} te debe <span className="text-success">{MXN.format(Math.abs(owedRounded))}</span>
          </p>
        ) : (
          <p className="text-lg font-semibold text-ink">Están a mano ✓</p>
        )}
        <p className="mt-1 text-xs text-ink-soft">Calculado sobre gastos aprobados, divididos 50/50.</p>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-subtle bg-card shadow-ambient">
        {expenseList.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Todavía no hay gastos registrados.</p>
        ) : (
          expenseList.map((expense, i) => {
            const isMine = expense.paidByParentId === parentId;
            const canDecide = !isMine && expense.status === "pending_approval";
            return (
              <div key={expense.id} className={`p-4 ${i > 0 ? "border-t border-subtle" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {childName(expense.childId)} · {MXN.format(expense.amountMxn)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">{expense.description}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Pagó {parentName(expense.paidByParentId)} · {formatDate(expense.createdAt)}
                    </p>
                    {expense.receiptUrl && (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-purple underline"
                      >
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[expense.status]}`}
                  >
                    {STATUS_LABEL[expense.status]}
                  </span>
                </div>

                {canDecide && (
                  <div className="mt-3 flex gap-2">
                    <form action={updateExpenseStatusAction}>
                      <input type="hidden" name="as" value={as ?? ""} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button type="submit" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                        Aprobar
                      </button>
                    </form>
                    <form action={updateExpenseStatusAction}>
                      <input type="hidden" name="as" value={as ?? ""} />
                      <input type="hidden" name="expenseId" value={expense.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                        Rechazar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="mt-8 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Nuevo gasto</h2>

        {children.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Agrega al menos un hijo (en /registro) antes de registrar un gasto.</p>
        ) : (
          <form action={createExpenseAction} className="mt-4 flex flex-col gap-3" encType="multipart/form-data">
            <input type="hidden" name="as" value={as ?? ""} />

            <select name="childId" required className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>

            <input
              type="number"
              name="amountMxn"
              step="0.01"
              min="0.01"
              required
              placeholder="Monto en MXN"
              className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />

            <textarea
              name="description"
              required
              minLength={3}
              maxLength={280}
              rows={2}
              placeholder="Descripción (ej. Consulta pediatra, útiles escolares...)"
              className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-soft">Comprobante (imagen o PDF, opcional)</label>
              <input
                type="file"
                name="receipt"
                accept="image/*,application/pdf"
                className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink"
              />
              <p className="text-xs text-ink-faint">
                O pega una URL si ya tienes el comprobante subido en otro lado:
              </p>
              <input
                type="url"
                name="receiptUrlManual"
                placeholder="https://..."
                className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              />
            </div>

            <button type="submit" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
              Registrar gasto
            </button>
          </form>
        )}
      </section>

      <AppNav active="Gastos" />
    </div>
  );
}
