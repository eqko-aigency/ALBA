import Link from "next/link";
import { formatPeriodLabel, periodKey, type Expense } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import {
  confirmExpenseSettlementAction,
  confirmExpenseSplitAction,
  createExpenseAction,
  proposeExpenseCounterAction,
  proposeExpenseSplitAction,
  registerExpenseSettlementAction,
  rejectExpenseSplitAction,
  resolveExpenseCounterAction,
  updateExpenseStatusAction,
} from "./actions";
import { PensionSection } from "./PensionSection";
import { SubmitButton } from "@/components/SubmitButton";

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
  searchParams: Promise<{ as?: string; tab?: string; period?: string }>;
}) {
  const { as, tab: tabParam, period: periodParam } = await searchParams;
  const tab: "gastos" | "pension" = tabParam === "pension" ? "pension" : "gastos";
  const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : periodKey(new Date());
  const { pairing, expenses, pension, parentId } = await getRequestContext(as);

  const [expenseList, children, familyMembers, balance, pensionSettings, pensionPayments, expenseSplit, latestSettlement] =
    await Promise.all([
      expenses.listExpenses(parentId),
      pairing.getMyChildren(parentId),
      pairing.listFamilyMembers(parentId),
      expenses.getBalance(parentId),
      pension.getSettings(parentId),
      pension.listPayments(parentId),
      expenses.getExpenseSplit(parentId),
      expenses.getLatestExpenseSettlement(parentId),
    ]);

  const childName = (childId: string) => children.find((c) => c.id === childId)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";
  const otherParentName = balance.otherParentId ? parentName(balance.otherParentId) : null;

  // Redondeo de centavos — evita mostrar "Están a mano" como "$0.00 de
  // diferencia" por errores de punto flotante al dividir /2.
  const owedRounded = Math.round(balance.amountMxnOwedByCaller * 100) / 100;
  const asQuery = as === "b" ? "&as=b" : "";

  // Reparto: % confirmado que me toca a mí, derivado del % del proponente.
  const myConfirmedPct =
    expenseSplit?.status === "confirmed"
      ? expenseSplit.proposedByParentId === parentId
        ? expenseSplit.proposerSharePct
        : 100 - expenseSplit.proposerSharePct
      : null;
  const otherConfirmedPct = myConfirmedPct !== null ? 100 - myConfirmedPct : null;
  const splitPendingFromOther = expenseSplit?.status === "pending" && expenseSplit.proposedByParentId !== parentId;
  const splitPendingFromMe = expenseSplit?.status === "pending" && expenseSplit.proposedByParentId === parentId;

  // Liquidar saldo: mismo patrón que Pensión — quien debe marca "pagué",
  // el otro confirma. owedRounded > 0 significa que yo debo.
  const pendingSettlement = latestSettlement && !latestSettlement.confirmedAt ? latestSettlement : null;
  const iCanSettleDebt = owedRounded > 0 && !pendingSettlement;
  const iRegisteredPendingSettlement = pendingSettlement?.paidByParentId === parentId;
  const iCanConfirmSettlement = pendingSettlement !== null && pendingSettlement.paidByParentId !== parentId;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/gastos" : "/gastos?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <Link
        href={`/mas${as === "b" ? "?as=b" : ""}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Más
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Gastos</h1>
      <p className="mt-2 text-ink-soft">
        {tab === "pension"
          ? "Pagos fijos mensuales de pensión, con historial y confirmación."
          : "Registra gastos, aprueba los del otro progenitor y lleva el balance."}
      </p>

      <div className="mt-4 inline-flex rounded-full border border-subtle bg-sand p-1">
        <Link
          href={`/gastos?tab=pension&period=${period}${asQuery}`}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            tab === "pension" ? "bg-card text-ink shadow-ambient" : "text-ink-soft"
          }`}
        >
          Pensión
        </Link>
        <Link
          href={`/gastos?tab=gastos${asQuery}`}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            tab === "gastos" ? "bg-card text-ink shadow-ambient" : "text-ink-soft"
          }`}
        >
          Gastos
        </Link>
      </div>

      {tab === "pension" ? (
        <PensionSection
          as={as}
          period={period}
          parentId={parentId}
          settings={pensionSettings}
          payments={pensionPayments}
          familyMembers={familyMembers}
        />
      ) : (
        <>
      <a
        href={`/gastos/export?period=${period}${asQuery}`}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline"
      >
        Exportar CSV de {formatPeriodLabel(period)}
      </a>

      <section className="mt-6 rounded-xl border border-subtle bg-card p-5 text-center shadow-ambient">
        {!otherParentName ? (
          <p className="text-sm text-ink-soft">
            Empareja al otro progenitor desde tu Perfil para poder calcular el balance de gastos.
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
        <p className="mt-1 text-xs text-ink-soft">Calculado sobre gastos aprobados — ver el reparto abajo.</p>

        {iCanSettleDebt && (
          <form action={registerExpenseSettlementAction} className="mt-3">
            <input type="hidden" name="as" value={as ?? ""} />
            <input type="hidden" name="amountMxn" value={owedRounded} />
            <SubmitButton pendingText="Registrando…" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
              Marcar como pagado
            </SubmitButton>
          </form>
        )}
        {iRegisteredPendingSettlement && (
          <p className="mt-2 text-xs text-ink-soft">
            Marcaste que pagaste {MXN.format(pendingSettlement!.amountMxn)} — esperando que {otherParentName} lo confirme.
          </p>
        )}
        {iCanConfirmSettlement && (
          <form action={confirmExpenseSettlementAction} className="mt-3">
            <input type="hidden" name="as" value={as ?? ""} />
            <input type="hidden" name="settlementId" value={pendingSettlement!.id} />
            <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
              Confirmar que recibí el pago
            </SubmitButton>
          </form>
        )}
      </section>

      {otherParentName && (
        <section className="mt-4 rounded-xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Reparto de gastos</p>

          {splitPendingFromOther ? (
            <>
              <p className="mt-1 text-sm text-ink">
                {otherParentName} propone cubrir {expenseSplit!.proposerSharePct}% / tú {100 - expenseSplit!.proposerSharePct}%
              </p>
              <div className="mt-3 flex gap-2">
                <form action={confirmExpenseSplitAction}>
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="splitId" value={expenseSplit!.id} />
                  <SubmitButton pendingText="Aceptando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                    Aceptar
                  </SubmitButton>
                </form>
                <form action={rejectExpenseSplitAction}>
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="splitId" value={expenseSplit!.id} />
                  <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                    Rechazar
                  </SubmitButton>
                </form>
              </div>
            </>
          ) : splitPendingFromMe ? (
            <p className="mt-1 text-sm text-ink-soft">
              Esperando que {otherParentName} confirme tu propuesta (tú {expenseSplit!.proposerSharePct}% / {otherParentName} {100 - expenseSplit!.proposerSharePct}%)
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink">
                {myConfirmedPct !== null
                  ? `Reparto actual: tú ${myConfirmedPct}% / ${otherParentName} ${otherConfirmedPct}%`
                  : "Reparto actual: 50/50 (predeterminado)"}
              </p>
              <details className="mt-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer text-xs font-semibold text-ink underline">Proponer otro reparto</summary>
                <form action={proposeExpenseSplitAction} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="as" value={as ?? ""} />
                  <label className="text-xs font-medium text-ink-soft">
                    Yo cubro ___% (el otro progenitor cubre el resto)
                    <input
                      type="number"
                      name="proposerSharePct"
                      min="1"
                      max="99"
                      required
                      defaultValue={50}
                      className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                    />
                  </label>
                  <SubmitButton pendingText="Proponiendo…" className="self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
                    Proponer
                  </SubmitButton>
                </form>
              </details>
            </>
          )}
        </section>
      )}

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
                    <p className="mt-0.5 break-all text-sm text-ink-soft">{expense.description}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Pagó {parentName(expense.paidByParentId)} · {formatDate(expense.createdAt)}
                    </p>
                    {expense.receiptUrl && (
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-purple/30 bg-purple/10 px-3 py-1 text-xs font-semibold text-purple transition-all hover:bg-purple/20"
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
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <form action={updateExpenseStatusAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="status" value="approved" />
                        <SubmitButton pendingText="Aprobando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                          Aprobar
                        </SubmitButton>
                      </form>
                      <form action={updateExpenseStatusAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                          Rechazar
                        </SubmitButton>
                      </form>
                    </div>
                    <details className="[&_summary::-webkit-details-marker]:hidden">
                      <summary className="cursor-pointer text-xs font-medium text-ink-soft underline">Contraoferta</summary>
                      <form action={proposeExpenseCounterAction} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <input
                          type="number"
                          name="counterAmountMxn"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Monto que puedes cubrir"
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                        />
                        <textarea
                          name="counterComment"
                          required
                          minLength={3}
                          maxLength={280}
                          rows={2}
                          placeholder="¿Por qué?"
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                        />
                        <SubmitButton pendingText="Enviando…" className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink">
                          Mandar contraoferta
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                )}

                {expense.status === "countered" && (
                  <div className="mt-3 rounded-md border border-purple/30 bg-purple/10 p-3">
                    <p className="text-sm text-ink">
                      {expense.counteredByParentId === parentId
                        ? `Tú ofreces cubrir ${MXN.format(expense.counterAmountMxn!)}`
                        : `${parentName(expense.counteredByParentId!)} ofrece cubrir ${MXN.format(expense.counterAmountMxn!)}`}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">&quot;{expense.counterComment}&quot;</p>
                    {expense.paidByParentId === parentId && (
                      <div className="mt-2 flex gap-2">
                        <form action={resolveExpenseCounterAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="accept" value="true" />
                          <SubmitButton pendingText="Aceptando…" className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                            Aceptar contraoferta
                          </SubmitButton>
                        </form>
                        <form action={resolveExpenseCounterAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="expenseId" value={expense.id} />
                          <input type="hidden" name="accept" value="false" />
                          <SubmitButton pendingText="Rechazando…" className="rounded-full bg-danger/20 px-3 py-1.5 text-xs font-semibold text-ink">
                            Rechazar contraoferta
                          </SubmitButton>
                        </form>
                      </div>
                    )}
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
          <p className="mt-3 text-sm text-ink-soft">Agrega al menos un hijo desde tu Perfil antes de registrar un gasto.</p>
        ) : (
          <form action={createExpenseAction} className="mt-4 flex flex-col gap-3" encType="multipart/form-data">
            <input type="hidden" name="as" value={as ?? ""} />

            <select name="childId" required className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink">
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
              className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
            />

            <textarea
              name="description"
              required
              minLength={3}
              maxLength={280}
              rows={2}
              placeholder="Descripción (ej. Consulta pediatra, útiles escolares...)"
              className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-soft">Comprobante (imagen o PDF, opcional)</label>
              <input
                type="file"
                name="receipt"
                accept="image/*,application/pdf"
                className="w-full min-w-0 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink"
              />
              <p className="text-xs text-ink-faint">
                O pega una URL si ya tienes el comprobante subido en otro lado:
              </p>
              <input
                type="url"
                name="receiptUrlManual"
                placeholder="https://..."
                className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
            </div>

            <SubmitButton pendingText="Registrando…" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
              Registrar gasto
            </SubmitButton>
          </form>
        )}
      </section>
        </>
      )}

      <AppNav active="Más" />
    </div>
  );
}
