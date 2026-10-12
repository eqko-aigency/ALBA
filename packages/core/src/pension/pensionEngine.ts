import type { PensionPayment, PensionPeriodStatus, PensionSettings } from "../domain/entities";

/** period siempre llega validado por pensionPaymentInputSchema (regex
 * /^\d{4}-\d{2}$/) antes de entrar acá — los defaults solo satisfacen a
 * TypeScript (noUncheckedIndexedAccess), nunca se usan en la práctica. */
function parsePeriod(period: string): { year: number; month: number } {
  const [year, month] = period.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1 };
}

/**
 * Estado de un período de Pensión — 100% determinístico (mismo criterio
 * que findComplianceIssues en complianceEngine.ts), nunca se guarda en la
 * base: se deriva en cada lectura a partir de settings + el pago (si
 * existe) + la hora actual. Evita que un estado guardado quede
 * desincronizado si nadie vuelve a tocar la fila después de vencer.
 */
export function getPensionPeriodStatus(
  settings: PensionSettings,
  payment: PensionPayment | undefined,
  period: string,
  now: Date
): PensionPeriodStatus {
  if (payment) return payment.confirmedAt ? "paid_confirmed" : "paid_unconfirmed";

  const { year, month } = parsePeriod(period);
  const dueDate = new Date(year, month - 1, settings.dueDay, 23, 59, 59);
  return now > dueDate ? "overdue" : "upcoming";
}

/** "YYYY-MM" del mes de `date`. */
export function periodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** period ± n meses, como "YYYY-MM". */
export function shiftPeriod(period: string, deltaMonths: number): string {
  const { year, month } = parsePeriod(period);
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return periodKey(d);
}

export function formatPeriodLabel(period: string): string {
  const { year, month } = parsePeriod(period);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
