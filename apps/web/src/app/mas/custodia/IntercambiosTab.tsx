import type { Child, CustodyAgreement, CustodyRepository, Parent } from "@alba/core";
import { findComplianceIssues } from "@alba/core";
import { SubmitButton } from "@/components/SubmitButton";
import { confirmCheckinAction, confirmCheckoutAction } from "@/app/calendario/actions";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const r = new Date(date);
  r.setHours(h ?? 0, m ?? 0, 0, 0);
  return r;
}

export async function IntercambiosTab({
  as,
  parentId,
  agreement,
  kids,
  familyMembers,
  custody,
}: {
  as?: string;
  parentId: string;
  agreement: CustodyAgreement;
  kids: Child[];
  familyMembers: Parent[];
  custody: CustodyRepository;
}) {
  if (agreement.slots.length === 0) {
    return (
      <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
        <p className="text-sm text-ink-soft">Para ver los intercambios, primero activa un convenio de custodia.</p>
        <a
          href={`/mas/custodia?tab=calendario${as === "b" ? "&as=b" : ""}`}
          className="mt-3 inline-block rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink"
        >
          Ir a Calendario
        </a>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = addDays(today, -7);
  const rangeEnd = addDays(today, 8); // exclusivo: hoy + 7 días adelante

  const [events, places] = await Promise.all([
    custody.listEventsForRange(parentId, isoDateLocal(rangeStart), isoDateLocal(rangeEnd)),
    custody.listMeetingPlaces(parentId),
  ]);

  const childName = (id: string) => kids.find((c) => c.id === id)?.fullName ?? "—";
  const parentName = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "—");
  const placeName = (id: string | null) => (id ? (places.find((p) => p.id === id)?.name ?? null) : null);

  const now = new Date();
  type UpcomingItem = { day: Date; slot: CustodyAgreement["slots"][number]; scheduledIn: Date; scheduledOut: Date };
  const upcoming: UpcomingItem[] = [];
  for (let i = 0; i < 8; i++) {
    const day = addDays(today, i);
    const weekday = day.getDay();
    for (const slot of agreement.slots) {
      if (slot.weekday !== weekday) continue;
      const scheduledIn = combineDateAndTime(day, slot.startTime);
      const scheduledOut = combineDateAndTime(day, slot.endTime);
      if (scheduledOut >= now) upcoming.push({ day, slot, scheduledIn, scheduledOut });
    }
  }
  upcoming.sort((a, b) => a.scheduledIn.getTime() - b.scheduledIn.getTime());

  type HistoryItem = { day: Date; issues: ReturnType<typeof findComplianceIssues> };
  const history: HistoryItem[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, -i);
    if (!agreement.slots.some((s) => s.weekday === day.getDay())) continue;
    history.push({ day, issues: findComplianceIssues(agreement, events, day) });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink">Próximos intercambios</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay intercambios programados en los próximos 7 días.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map(({ day, slot, scheduledIn, scheduledOut }, idx) => {
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
              const isMySlotToday = isoDateLocal(day) === isoDateLocal(today) && slot.parentId === parentId;
              return (
                <li key={idx} className="rounded-xl border border-subtle bg-card px-3.5 py-3 shadow-ambient">
                  <span className="text-sm text-ink">
                    {WEEKDAY_LABELS[day.getDay()]} {slot.startTime}–{slot.endTime} · {childName(slot.childId)} con{" "}
                    <strong>{parentName(slot.parentId)}</strong>
                  </span>
                  {placeName(slot.placeId) && <p className="mt-1 text-xs text-ink-soft">📍 {placeName(slot.placeId)}</p>}
                  {isMySlotToday && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {checkinEvent?.confirmedAt ? (
                        <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">✓ Check-in confirmado</span>
                      ) : (
                        <form action={confirmCheckinAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="childId" value={slot.childId} />
                          <input type="hidden" name="scheduledAt" value={scheduledIn.toISOString()} />
                          <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink">
                            Confirmar check-in
                          </SubmitButton>
                        </form>
                      )}
                      {checkoutEvent?.confirmedAt ? (
                        <span className="rounded-full bg-success/20 px-3 py-1.5 text-xs font-semibold text-ink">✓ Check-out confirmado</span>
                      ) : (
                        <form action={confirmCheckoutAction}>
                          <input type="hidden" name="as" value={as ?? ""} />
                          <input type="hidden" name="childId" value={slot.childId} />
                          <input type="hidden" name="scheduledAt" value={scheduledOut.toISOString()} />
                          <SubmitButton
                            pendingText="Confirmando…"
                            className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-medium text-ink"
                          >
                            Confirmar check-out
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink">Historial</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay intercambios pasados que mostrar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map(({ day, issues }) => (
              <li key={isoDateLocal(day)} className="rounded-xl border border-subtle bg-card px-3.5 py-3 shadow-ambient">
                <p className="text-sm font-semibold text-ink">
                  {WEEKDAY_LABELS[day.getDay()]} {day.getDate()}/{day.getMonth() + 1}
                </p>
                {issues.length === 0 ? (
                  <p className="mt-1 text-xs font-medium text-success">✓ A tiempo</p>
                ) : (
                  issues.map((issue, idx) => (
                    <p
                      key={idx}
                      className={`mt-1 text-xs font-semibold ${issue.type === "late_checkin" ? "text-orange-deep" : "text-danger"}`}
                    >
                      {childName(issue.childId)} ·{" "}
                      {issue.type === "missed_checkin" && "Sin confirmar"}
                      {issue.type === "late_checkin" && `Tardío (${issue.minutesLate} min)`}
                    </p>
                  ))
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
