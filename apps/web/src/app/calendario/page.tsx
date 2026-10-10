import Link from "next/link";
import { findComplianceIssues, type ComplianceIssue } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { confirmCheckinAction, confirmCheckoutAction, removeSlotAction, upsertSlotAction } from "./actions";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEKDAY_SHORT = ["D", "L", "M", "M", "J", "V", "S"];

/** Color consistente por progenitor en todo el calendario — "Tú" siempre
 * naranja, el otro progenitor siempre cielo, sin importar el orden en que
 * vengan de la base. */
function parentAccent(isCallerSlot: boolean): { avatar: string; chip: string } {
  return isCallerSlot ? { avatar: "bg-orange", chip: "bg-dawn" } : { avatar: "bg-sky", chip: "bg-sea" };
}

/** Fecha local "YYYY-MM-DD" — evita el corrimiento de día que da
 * toISOString().slice(0, 10) cuando la zona horaria local no es UTC. */
function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(reference: Date, offsetWeeks: number): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + offsetWeeks * 7);
  return d;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(h ?? 0, m ?? 0, 0, 0);
  return result;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === "left" ? "M12.5 15l-5-5 5-5" : "M7.5 15l5-5-5-5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; week?: string }>;
}) {
  const { as, week } = await searchParams;
  const { pairing, custody, parentId } = await getRequestContext(as);
  const weekOffset = week ? Number(week) || 0 : 0;
  const asQuery = as === "b" ? "&as=b" : "";

  const now = new Date();
  const weekStartDate = startOfWeek(now, weekOffset);
  const weekStart = isoDateLocal(weekStartDate);

  const [agreement, children, events, familyMembers] = await Promise.all([
    custody.getMyAgreement(parentId),
    pairing.getMyChildren(parentId),
    custody.listEventsForWeek(parentId, weekStart),
    pairing.listFamilyMembers(parentId),
  ]);

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";

  // findComplianceIssues es 100% determinístico (packages/core) — se corre
  // una vez por día de la semana visible, siempre sobre el MISMO arreglo
  // agreement.slots, para poder comparar por referencia (issue.slot ===
  // slot) más abajo al renderizar cada slot.
  const issuesByDay = new Map<string, ComplianceIssue[]>();
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStartDate);
    day.setDate(day.getDate() + i);
    issuesByDay.set(isoDateLocal(day), findComplianceIssues(agreement, events, day));
  }

  const todayKey = isoDateLocal(now);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/calendario" : "/calendario?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Calendario de custodia</h1>
      <p className="mt-2 text-ink-soft">Confirma tus check-in/check-out y revisa el convenio de la semana.</p>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-card px-3 py-2.5 shadow-ambient">
        <Link
          href={`/calendario?week=${weekOffset - 1}${asQuery}`}
          aria-label="Semana anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand"
        >
          <ChevronIcon direction="left" />
        </Link>
        <span className="text-sm font-semibold text-ink">
          {formatDay(weekStartDate)} – {formatDay(new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 6)))}
        </span>
        <Link
          href={`/calendario?week=${weekOffset + 1}${asQuery}`}
          aria-label="Semana siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand"
        >
          <ChevronIcon direction="right" />
        </Link>
      </div>

      <div className="mt-4 flex justify-between gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStartDate);
          day.setDate(day.getDate() + i);
          const dayKey = isoDateLocal(day);
          const isToday = dayKey === todayKey;
          const daySlots = agreement.slots.filter((s) => s.weekday === day.getDay());
          const hasIssue = (issuesByDay.get(dayKey) ?? []).length > 0;

          return (
            <a
              key={dayKey}
              href={`#dia-${dayKey}`}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                isToday ? "bg-orange text-ink shadow-ambient" : "bg-card text-ink-soft hover:bg-dawn/60"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide">{WEEKDAY_SHORT[day.getDay()]}</span>
              <span className="text-sm font-semibold">{day.getDate()}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hasIssue ? "bg-danger" : daySlots.length > 0 ? "bg-success" : "bg-transparent"
                }`}
              />
            </a>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStartDate);
          day.setDate(day.getDate() + i);
          const dayKey = isoDateLocal(day);
          const isToday = dayKey === todayKey;
          const daySlots = agreement.slots.filter((s) => s.weekday === day.getDay());
          const dayIssues = issuesByDay.get(dayKey) ?? [];

          return (
            <div
              key={dayKey}
              id={`dia-${dayKey}`}
              className={`scroll-mt-20 rounded-2xl border bg-card p-4 shadow-ambient ${
                isToday ? "border-orange" : "border-subtle"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {WEEKDAY_LABELS[day.getDay()]} · {formatDay(day)}
                {isToday && (
                  <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-ink">Hoy</span>
                )}
              </p>

              {daySlots.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">Sin slots configurados para este día.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {daySlots.map((slot, idx) => {
                    const scheduledIn = combineDateAndTime(day, slot.startTime);
                    const scheduledOut = combineDateAndTime(day, slot.endTime);
                    // El issue solo se muestra si el horario programado ya
                    // pasó — sin este filtro, un slot de más tarde el mismo
                    // día aparecería como "check-in faltante" antes de que
                    // tocara ocurrir (findComplianceIssues no sabe la hora
                    // actual, solo compara contra el día completo).
                    const slotIssue =
                      scheduledIn <= now ? dayIssues.find((issue) => issue.slot === slot) : undefined;

                    const checkinEvent = events.find(
                      (e) =>
                        e.type === "checkin" &&
                        e.childId === slot.childId &&
                        e.parentId === slot.parentId &&
                        e.scheduledAt === scheduledIn.toISOString()
                    );
                    const checkoutEvent = events.find(
                      (e) =>
                        e.type === "checkout" &&
                        e.childId === slot.childId &&
                        e.parentId === slot.parentId &&
                        e.scheduledAt === scheduledOut.toISOString()
                    );
                    const isMySlotToday = isToday && slot.parentId === parentId;
                    const accent = parentAccent(slot.parentId === parentId);
                    const parentDisplayName = parentName(slot.parentId);

                    return (
                      <li key={idx} className={`rounded-xl px-3 py-2.5 ${accent.chip}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm text-ink">
                            <span
                              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink ${accent.avatar}`}
                            >
                              {parentDisplayName.charAt(0).toUpperCase()}
                            </span>
                            {childName(slot.childId)} con <strong>{parentDisplayName}</strong>
                          </span>
                          <span className="whitespace-nowrap text-xs text-ink-soft">
                            {slot.startTime}–{slot.endTime}
                          </span>
                        </div>

                        {slotIssue && (
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              slotIssue.type === "late_checkin" ? "text-orange-deep" : "text-danger"
                            }`}
                          >
                            {slotIssue.type === "missed_checkin" && "⚠ Check-in sin confirmar"}
                            {slotIssue.type === "late_checkin" && `⚠ Check-in tardío (${slotIssue.minutesLate} min)`}
                          </p>
                        )}

                        {isMySlotToday && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {checkinEvent?.confirmedAt ? (
                              <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                                ✓ Check-in confirmado
                              </span>
                            ) : (
                              <form action={confirmCheckinAction}>
                                <input type="hidden" name="as" value={as ?? ""} />
                                <input type="hidden" name="childId" value={slot.childId} />
                                <input type="hidden" name="scheduledAt" value={scheduledIn.toISOString()} />
                                <button
                                  type="submit"
                                  className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink"
                                >
                                  Confirmar check-in
                                </button>
                              </form>
                            )}

                            {checkoutEvent?.confirmedAt ? (
                              <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">
                                ✓ Check-out confirmado
                              </span>
                            ) : (
                              <form action={confirmCheckoutAction}>
                                <input type="hidden" name="as" value={as ?? ""} />
                                <input type="hidden" name="childId" value={slot.childId} />
                                <input type="hidden" name="scheduledAt" value={scheduledOut.toISOString()} />
                                <button
                                  type="submit"
                                  className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-medium text-ink"
                                >
                                  Confirmar check-out
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Convenio — slots de custodia</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Tolerancia antes de marcar un check-in como tardío: {agreement.toleranceMinutes} minutos.
        </p>

        {agreement.slots.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {agreement.slots.map((slot, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2 text-sm text-ink"
              >
                <span>
                  {WEEKDAY_LABELS[slot.weekday]} {slot.startTime}–{slot.endTime} · {childName(slot.childId)} ·{" "}
                  {parentName(slot.parentId)}
                </span>
                <form action={removeSlotAction}>
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="slotIndex" value={idx} />
                  <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {children.length === 0 || familyMembers.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Agrega al menos un hijo (en /registro) y empareja al otro progenitor antes de poder configurar slots.
          </p>
        ) : (
          <form action={upsertSlotAction} className="mt-4 flex flex-col gap-2">
            <input type="hidden" name="as" value={as ?? ""} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                name="childId"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
              <select
                name="parentId"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              >
                {familyMembers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === parentId ? "Tú" : p.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                name="weekday"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              >
                {WEEKDAY_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                name="startTime"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              />
              <input
                type="time"
                name="endTime"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
              />
            </div>
            <button
              type="submit"
              className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink"
            >
              Agregar slot
            </button>
          </form>
        )}
      </section>

      <AppNav active="Calendario" />
    </div>
  );
}
