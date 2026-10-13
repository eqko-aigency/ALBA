import Link from "next/link";
import {
  formatPeriodLabel,
  getPensionPeriodStatus,
  shiftPeriod,
  type Parent,
  type PensionPayment,
  type PensionSettings,
} from "@alba/core";
import { confirmPensionPaymentAction, registerPensionPaymentAction, upsertPensionSettingsAction } from "./pensionActions";
import { SubmitButton } from "@/components/SubmitButton";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const STATUS_LABEL = {
  paid_confirmed: "Confirmada",
  paid_unconfirmed: "Pagada · sin confirmar",
  overdue: "Vencida · con deuda",
  upcoming: "Próxima",
} as const;

const STATUS_CLASS = {
  paid_confirmed: "bg-success/20 text-ink",
  paid_unconfirmed: "border border-orange bg-dawn text-ink",
  overdue: "bg-danger/20 text-danger",
  upcoming: "border border-subtle bg-sand text-ink-soft",
} as const;

function daysBetween(a: Date, b: Date): number {
  const ms = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() -
    new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round(ms / 86400000);
}

export async function PensionSection({
  as,
  period,
  parentId,
  settings,
  payments,
  familyMembers,
}: {
  as?: string;
  period: string;
  parentId: string;
  settings: PensionSettings | null;
  payments: PensionPayment[];
  familyMembers: Parent[];
}) {
  const asQuery = as === "b" ? "&as=b" : "";
  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";

  if (!settings) {
    return (
      <section className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Configurar pensión</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Monto fijo y día de vencimiento mensual — se configura una vez, ambos progenitores lo pueden ajustar después.
        </p>
        {familyMembers.length < 2 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Empareja al otro progenitor (en /registro) antes de configurar la pensión.
          </p>
        ) : (
          <form action={upsertPensionSettingsAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="as" value={as ?? ""} />
            <select name="payerParentId" required className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
              {familyMembers.map((p) => (
                <option key={p.id} value={p.id}>
                  Paga: {p.id === parentId ? "Tú" : p.fullName}
                </option>
              ))}
            </select>
            <input
              type="number"
              name="amountMxn"
              step="0.01"
              min="0.01"
              required
              placeholder="Monto mensual en MXN"
              className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />
            <label className="text-xs font-medium text-ink-soft">
              Día del mes en que vence (1-28)
              <input
                type="number"
                name="dueDay"
                min="1"
                max="28"
                required
                defaultValue={1}
                className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              />
            </label>
            <button type="submit" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
              Guardar configuración
            </button>
          </form>
        )}
      </section>
    );
  }

  const now = new Date();
  const payment = payments.find((p) => p.period === period);
  const status = getPensionPeriodStatus(settings, payment, period, now);
  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, (m ?? 1) - 1, settings.dueDay);
  const overdueDays = status === "overdue" ? daysBetween(now, dueDate) : 0;
  const isPayer = settings.payerParentId === parentId;
  const canRegister = isPayer && !payment;
  const canConfirm = payment && !payment.confirmedAt && payment.paidByParentId !== parentId;

  const prevHref = `/gastos?tab=pension&period=${shiftPeriod(period, -1)}${asQuery}`;
  const nextHref = `/gastos?tab=pension&period=${shiftPeriod(period, 1)}${asQuery}`;

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
        <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
          <Link href={prevHref} aria-label="Período anterior" className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-sand">
            ‹
          </Link>
          <span className="text-sm font-semibold text-ink">{formatPeriodLabel(period)}</span>
          <Link href={nextHref} aria-label="Período siguiente" className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-sand">
            ›
          </Link>
        </div>

        <div className="p-5">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <p className="mt-2 text-3xl font-semibold text-ink">{MXN.format(payment?.amountMxn ?? settings.amountMxn)}</p>
          <p className="mt-1 text-xs text-ink-faint">
            Paga {parentName(settings.payerParentId)} · vence el día {settings.dueDay}
          </p>
          {status === "overdue" && (
            <p className="mt-1 text-xs font-semibold text-danger">Vencida hace {overdueDays} día{overdueDays === 1 ? "" : "s"}</p>
          )}
          {payment?.confirmedAt && (
            <p className="mt-1 text-xs text-ink-faint">Confirmada por {parentName(payment.confirmedByParentId!)}</p>
          )}

          {canRegister && (
            <form action={registerPensionPaymentAction} className="mt-4">
              <input type="hidden" name="as" value={as ?? ""} />
              <input type="hidden" name="period" value={period} />
              <SubmitButton
                pendingText="Registrando…"
                className={`w-full rounded-full px-4 py-3 text-sm font-semibold text-ink shadow-ambient ${
                  status === "overdue" ? "bg-danger/80" : "bg-orange"
                }`}
              >
                + Registrar pago
              </SubmitButton>
            </form>
          )}

          {canConfirm && (
            <form action={confirmPensionPaymentAction} className="mt-4">
              <input type="hidden" name="as" value={as ?? ""} />
              <input type="hidden" name="paymentId" value={payment!.id} />
              <SubmitButton pendingText="Confirmando…" className="w-full rounded-full bg-orange px-4 py-3 text-sm font-semibold text-ink shadow-ambient">
                Confirmar que recibí el pago
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-subtle bg-card shadow-ambient">
        <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Historial · {payments.length} registro{payments.length === 1 ? "" : "s"}
        </p>
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Todavía no hay pagos registrados.</p>
        ) : (
          payments.map((p, i) => {
            const pStatus = getPensionPeriodStatus(settings, p, p.period, now);
            return (
              <Link
                key={p.id}
                href={`/gastos?tab=pension&period=${p.period}${asQuery}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-subtle" : ""}`}
              >
                <span>
                  <span className="block text-sm font-medium text-ink">{formatPeriodLabel(p.period)}</span>
                  <span className={`text-xs font-semibold ${pStatus === "paid_confirmed" ? "text-success" : "text-orange-deep"}`}>
                    {STATUS_LABEL[pStatus]}
                  </span>
                </span>
                <span className="text-sm font-semibold text-ink">{MXN.format(p.amountMxn)}</span>
              </Link>
            );
          })
        )}
      </section>

      <details className="mt-6 rounded-lg border border-subtle bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer text-xs font-medium text-ink-soft">Editar configuración de pensión</summary>
        <form action={upsertPensionSettingsAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="as" value={as ?? ""} />
          <select name="payerParentId" defaultValue={settings.payerParentId} className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
            {familyMembers.map((p) => (
              <option key={p.id} value={p.id}>
                Paga: {p.id === parentId ? "Tú" : p.fullName}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="amountMxn"
            step="0.01"
            min="0.01"
            required
            defaultValue={settings.amountMxn}
            className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          />
          <input
            type="number"
            name="dueDay"
            min="1"
            max="28"
            required
            defaultValue={settings.dueDay}
            className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          />
          <button type="submit" className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink">
            Guardar cambios
          </button>
        </form>
      </details>
    </>
  );
}
