import Link from "next/link";
import { findComplianceIssues, type ComplianceIssue } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { COLOR_CLASS } from "@/lib/profileColors";
import { AppNav } from "@/components/AppNav";
import { SubmitButton } from "@/components/SubmitButton";
import { CalendarIcon, FlagIcon, PinIcon, StarIcon } from "@/components/icons";
import {
  confirmCheckinAction,
  confirmCheckoutAction,
  createImportantDateAction,
  createMeetingPlaceAction,
  createVisitAction,
  deleteImportantDateAction,
  deleteMeetingPlaceAction,
  deleteVisitAction,
  removeSlotAction,
  updateMeetingPlaceAction,
  upsertSlotAction,
} from "./actions";

function AccordionHeader({
  label,
  accent,
  Icon,
}: {
  label: string;
  accent: string;
  Icon: typeof CalendarIcon;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">→</span>
    </summary>
  );
}

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

function parseDateKeyLocal(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeekDate(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Sunday on/before the 1st of the month — primera celda de la grilla, que
 * siempre arranca en domingo, estilo Google Calendar. */
function monthGridStart(monthDate: Date): Date {
  const first = startOfMonth(monthDate);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  return start;
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

function formatMonthLabel(d: Date): string {
  const label = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  searchParams: Promise<{ as?: string; month?: string; day?: string; view?: string }>;
}) {
  const { as, month, day, view: viewParam } = await searchParams;
  const { pairing, custody, parentId } = await getRequestContext(as);
  const asQuery = as === "b" ? "&as=b" : "";
  const view: "week" | "month" = viewParam === "week" ? "week" : "month";

  const now = new Date();
  const todayKey = isoDateLocal(now);

  const refMonthDate =
    month && /^\d{4}-\d{2}$/.test(month)
      ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
      : startOfMonth(now);

  const isCurrentMonth = refMonthDate.getFullYear() === now.getFullYear() && refMonthDate.getMonth() === now.getMonth();
  const defaultDayKey = isCurrentMonth ? todayKey : isoDateLocal(refMonthDate);
  const selectedDayKey = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : defaultDayKey;
  const selectedDate = parseDateKeyLocal(selectedDayKey);

  // Mes: grilla de 6 semanas (42 días) arrancando en domingo. Semana: tira
  // de 7 días arrancando en el domingo de la semana del día seleccionado.
  // Ambos vistas comparten exactamente el mismo panel de detalle de abajo.
  const visibleDays =
    view === "month"
      ? Array.from({ length: 42 }, (_, i) => addDays(monthGridStart(refMonthDate), i))
      : Array.from({ length: 7 }, (_, i) => addDays(startOfWeekDate(selectedDate), i));

  const rangeStart = isoDateLocal(visibleDays[0]);
  const rangeEnd = isoDateLocal(addDays(visibleDays[visibleDays.length - 1], 1));

  const [agreement, children, familyMembers, events, meetingPlaces, visits, importantDates, profile] = await Promise.all([
    custody.getMyAgreement(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    custody.listEventsForRange(parentId, rangeStart, rangeEnd),
    custody.listMeetingPlaces(parentId),
    custody.listVisitsForRange(parentId, rangeStart, rangeEnd),
    custody.listImportantDatesForRange(parentId, rangeStart, rangeEnd),
    pairing.getProfile(parentId),
  ]);

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";
  const placeName = (id: string | null) => (id ? meetingPlaces.find((p) => p.id === id)?.name ?? null : null);

  // Color fijo por progenitor/hijo elegido en Perfil — a diferencia de
  // parentAccent (que siempre pinta "Tú" naranja y al otro cielo, relativo a
  // quién mira), esto es el MISMO color sin importar quién vea la pantalla.
  const parentColorClass = (id: string): string | null => {
    const p = id === parentId ? profile : familyMembers.find((m) => m.id === id);
    return p?.color ? COLOR_CLASS[p.color] ?? null : null;
  };
  const childColorClass = (id: string): string | null => {
    const c = children.find((ch) => ch.id === id);
    return c?.color ? COLOR_CLASS[c.color] ?? null : null;
  };

  // findComplianceIssues es 100% determinístico (packages/core) — se corre
  // una vez por día visible, siempre sobre el MISMO arreglo agreement.slots,
  // para poder comparar por referencia (issue.slot === slot) más abajo.
  const issuesByDay = new Map<string, ComplianceIssue[]>();
  for (const d of visibleDays) {
    issuesByDay.set(isoDateLocal(d), findComplianceIssues(agreement, events, d));
  }

  const isTodayVisible = visibleDays.some((d) => isoDateLocal(d) === todayKey);
  const todayHref = `/calendario?view=${view}&month=${monthKey(now)}&day=${todayKey}${asQuery}`;

  const prevHref =
    view === "month"
      ? `/calendario?view=month&month=${monthKey(addMonths(refMonthDate, -1))}${asQuery}`
      : `/calendario?view=week&day=${isoDateLocal(addDays(startOfWeekDate(selectedDate), -7))}${asQuery}`;
  const nextHref =
    view === "month"
      ? `/calendario?view=month&month=${monthKey(addMonths(refMonthDate, 1))}${asQuery}`
      : `/calendario?view=week&day=${isoDateLocal(addDays(startOfWeekDate(selectedDate), 7))}${asQuery}`;
  const headerLabel =
    view === "month"
      ? formatMonthLabel(refMonthDate)
      : `${formatDay(visibleDays[0])} – ${formatDay(visibleDays[6])}`;

  const dayCellHref = (dayKey: string) =>
    view === "month"
      ? `/calendario?view=month&month=${monthKey(refMonthDate)}&day=${dayKey}${asQuery}`
      : `/calendario?view=week&day=${dayKey}${asQuery}`;

  const selectedSlots = agreement.slots.filter((s) => s.weekday === selectedDate.getDay());
  const selectedVisits = visits.filter((v) => v.date === selectedDayKey);
  const selectedImportantDates = importantDates.filter((d) => d.startDate <= selectedDayKey && d.endDate >= selectedDayKey);
  const selectedIssues = issuesByDay.get(selectedDayKey) ?? [];
  const isSelectedToday = selectedDayKey === todayKey;

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

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Calendario de custodia y visitas</h1>
      <p className="mt-2 text-ink-soft">Toca un día para ver y confirmar check-in/check-out, y dónde se hace el encuentro.</p>

      <div className="mt-4 inline-flex rounded-full border border-subtle bg-sand p-1">
        <Link
          href={`/calendario?view=week&day=${selectedDayKey}${asQuery}`}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            view === "week" ? "bg-card text-ink shadow-ambient" : "text-ink-soft"
          }`}
        >
          Semana
        </Link>
        <Link
          href={`/calendario?view=month&month=${monthKey(refMonthDate)}&day=${selectedDayKey}${asQuery}`}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            view === "month" ? "bg-card text-ink shadow-ambient" : "text-ink-soft"
          }`}
        >
          Mes
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-card px-3 py-2.5 shadow-ambient">
        <Link
          href={prevHref}
          aria-label={view === "month" ? "Mes anterior" : "Semana anterior"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand"
        >
          <ChevronIcon direction="left" />
        </Link>
        <span className="text-sm font-semibold text-ink">{headerLabel}</span>
        <Link
          href={nextHref}
          aria-label={view === "month" ? "Mes siguiente" : "Semana siguiente"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand"
        >
          <ChevronIcon direction="right" />
        </Link>
      </div>

      {!isTodayVisible && (
        <Link href={todayHref} className="mt-2 inline-block text-xs font-semibold text-purple underline">
          Volver a hoy
        </Link>
      )}

      <div className="mt-4 rounded-2xl bg-card p-4 shadow-ambient">
        <div className="grid grid-cols-7 gap-y-2">
          {WEEKDAY_SHORT.map((label, i) => (
            <div key={i} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {label}
            </div>
          ))}
          {visibleDays.map((d) => {
            const dayKey = isoDateLocal(d);
            const inMonth = view === "week" || d.getMonth() === refMonthDate.getMonth();
            const isToday = dayKey === todayKey;
            const isSelected = dayKey === selectedDayKey;
            const daySlots = agreement.slots.filter((s) => s.weekday === d.getDay());
            const dayVisits = visits.filter((v) => v.date === dayKey);
            const dayImportantDates = importantDates.filter((imp) => imp.startDate <= dayKey && imp.endDate >= dayKey);
            const dayParentIds = [...new Set([...daySlots.map((s) => s.parentId), ...dayVisits.map((v) => v.parentId)])];
            const dayChildIds = [
              ...new Set([
                ...daySlots.map((s) => s.childId),
                ...dayVisits.map((v) => v.childId),
                ...dayImportantDates.filter((d) => d.childId).map((d) => d.childId!),
              ]),
            ];
            const hasIssue = (issuesByDay.get(dayKey) ?? []).length > 0;

            return (
              <Link
                key={dayKey}
                href={dayCellHref(dayKey)}
                className={`mx-auto flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-2xl text-base transition-colors ${
                  isSelected
                    ? "bg-orange text-ink shadow-ambient"
                    : isToday
                      ? "border-2 border-orange text-ink"
                      : inMonth
                        ? "text-ink hover:bg-dawn/60"
                        : "text-ink-faint/60"
                }`}
              >
                <span className="font-semibold">{d.getDate()}</span>
                {/* Dos puntos distintos, no uno solo: custodia (recurrente,
                    verde) y visita (puntual, morado) son cosas distintas —
                    antes un solo punto los mezclaba sin poder distinguirlos
                    de un vistazo. */}
                <span className="flex items-center gap-0.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasIssue ? "bg-danger" : daySlots.length > 0 ? "bg-success" : "bg-transparent"
                    }`}
                  />
                  <span className={`h-1.5 w-1.5 rounded-full ${dayVisits.length > 0 ? "bg-purple" : "bg-transparent"}`} />
                  <span
                    className={`h-1.5 w-1.5 rotate-45 ${dayImportantDates.length > 0 ? "bg-orange-deep" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                </span>
                {(dayParentIds.length > 0 || dayChildIds.length > 0) && (
                  <span className="flex h-1 w-8 overflow-hidden rounded-full">
                    <span className="flex flex-1">
                      {dayParentIds.map((pid) => (
                        <span key={pid} className={`flex-1 ${parentColorClass(pid) ?? "bg-ink-faint/40"}`} />
                      ))}
                    </span>
                    <span className="flex flex-1">
                      {dayChildIds.map((cid) => (
                        <span key={cid} className={`flex-1 ${childColorClass(cid) ?? "bg-ink-faint/40"}`} />
                      ))}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-orange bg-card p-4 shadow-ambient">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {WEEKDAY_LABELS[selectedDate.getDay()]} · {formatDay(selectedDate)}
          {isSelectedToday && (
            <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-ink">Hoy</span>
          )}
        </p>

        {selectedSlots.length === 0 && selectedVisits.length === 0 && selectedImportantDates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Sin nada programado para este día.</p>
        ) : selectedSlots.length === 0 ? null : (
          <ul className="mt-3 flex flex-col gap-2">
            {selectedSlots.map((slot, idx) => {
              const scheduledIn = combineDateAndTime(selectedDate, slot.startTime);
              const scheduledOut = combineDateAndTime(selectedDate, slot.endTime);
              // El issue solo se muestra si el horario programado ya pasó —
              // sin este filtro, un slot de más tarde el mismo día
              // aparecería como "check-in faltante" antes de que tocara
              // ocurrir (findComplianceIssues no sabe la hora actual, solo
              // compara contra el día completo).
              const slotIssue = scheduledIn <= now ? selectedIssues.find((issue) => issue.slot === slot) : undefined;

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
              const isMySlotToday = isSelectedToday && slot.parentId === parentId;
              const accent = parentAccent(slot.parentId === parentId);
              const fixedParentColor = parentColorClass(slot.parentId);
              const fixedChildColor = childColorClass(slot.childId);
              const parentDisplayName = parentName(slot.parentId);

              return (
                <li key={idx} className={`rounded-xl px-3 py-2.5 ${accent.chip}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink ${fixedParentColor ?? accent.avatar}`}
                      >
                        {parentDisplayName.charAt(0).toUpperCase()}
                      </span>
                      {childName(slot.childId)}
                      {fixedChildColor && <span className={`inline-block h-2 w-2 rounded-full ${fixedChildColor}`} aria-hidden="true" />}
                      {" "}con <strong>{parentDisplayName}</strong>
                    </span>
                    <span className="whitespace-nowrap text-xs text-ink-soft">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>

                  {placeName(slot.placeId) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                      <span aria-hidden="true">📍</span> {placeName(slot.placeId)}
                    </p>
                  )}

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
                          <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink">
                            Confirmar check-in
                          </SubmitButton>
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

        {/* Separado visualmente de los slots de custodia (chip morado, sin
            botones de check-in/check-out) — una visita puntual no es parte
            del convenio recurrente, no tiene cumplimiento que confirmar. */}
        {selectedVisits.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {selectedVisits.map((visit) => {
              const accent = parentAccent(visit.parentId === parentId);
              const fixedParentColor = parentColorClass(visit.parentId);
              const fixedChildColor = childColorClass(visit.childId);
              const parentDisplayName = parentName(visit.parentId);
              return (
                <li key={visit.id} className="rounded-xl border border-purple/30 bg-purple/10 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-ink ${fixedParentColor ?? accent.avatar}`}
                      >
                        {parentDisplayName.charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <span className="rounded-full bg-purple/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
                          Visita
                        </span>{" "}
                        {visit.title} — {childName(visit.childId)}
                        {fixedChildColor && <span className={`inline-block h-2 w-2 rounded-full ${fixedChildColor}`} aria-hidden="true" />}
                        {" "}con <strong>{parentDisplayName}</strong>
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-xs text-ink-soft">
                      {visit.startTime}–{visit.endTime}
                    </span>
                  </div>
                  {placeName(visit.placeId) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                      <span aria-hidden="true">📍</span> {placeName(visit.placeId)}
                    </p>
                  )}
                  <form action={deleteVisitAction} className="mt-2">
                    <input type="hidden" name="as" value={as ?? ""} />
                    <input type="hidden" name="visitId" value={visit.id} />
                    <button type="submit" className="text-xs font-medium text-danger underline">
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {selectedImportantDates.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {selectedImportantDates.map((d) => (
              <li key={d.id} className="rounded-xl border border-orange-deep/30 bg-dawn/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">
                    <span className="rounded-full bg-orange-deep/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
                      Fecha importante
                    </span>{" "}
                    {d.title}
                    {d.childId && <> — {childName(d.childId)}</>}
                  </span>
                </div>
                {d.startDate !== d.endDate && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {formatDay(parseDateKeyLocal(d.startDate))} – {formatDay(parseDateKeyLocal(d.endDate))}
                  </p>
                )}
                <form action={deleteImportantDateAction} className="mt-2">
                  <input type="hidden" name="as" value={as ?? ""} />
                  <input type="hidden" name="importantDateId" value={d.id} />
                  <button type="submit" className="text-xs font-medium text-danger underline">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
        <details className="group">
          <AccordionHeader label="Convenio — slots de custodia" accent="bg-sky" Icon={CalendarIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
        <p className="text-xs text-ink-soft">
          Tolerancia antes de marcar un check-in como tardío: {agreement.toleranceMinutes} minutos.
        </p>

        {agreement.slots.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {agreement.slots.map((slot, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2 text-base text-ink"
              >
                <span>
                  {WEEKDAY_LABELS[slot.weekday]} {slot.startTime}–{slot.endTime} · {childName(slot.childId)} ·{" "}
                  {parentName(slot.parentId)}
                  {placeName(slot.placeId) && ` · 📍 ${placeName(slot.placeId)}`}
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
            Agrega al menos un hijo y empareja al otro progenitor desde tu Perfil antes de poder configurar slots.
          </p>
        ) : (
          <form action={upsertSlotAction} className="mt-4 flex flex-col gap-2">
            <input type="hidden" name="as" value={as ?? ""} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                name="childId"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
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
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
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
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
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
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
              <input
                type="time"
                name="endTime"
                required
                className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
            </div>
            <select name="placeId" className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink">
              <option value="">Sin lugar específico</option>
              {meetingPlaces.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink"
            >
              Agregar slot
            </button>
          </form>
        )}
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Visitas" accent="bg-salmon" Icon={StarIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">
              Algo puntual (ej. "Ir al cine" un día específico) — a diferencia del convenio, una visita no se repite
              cada semana.
            </p>

            {visits.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {visits
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                  .map((visit) => (
                    <li
                      key={visit.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2 text-base text-ink"
                    >
                      <span>
                        {formatDay(parseDateKeyLocal(visit.date))} · {visit.title} · {visit.startTime}–{visit.endTime} ·{" "}
                        {childName(visit.childId)} · {parentName(visit.parentId)}
                        {placeName(visit.placeId) && ` · 📍 ${placeName(visit.placeId)}`}
                      </span>
                      <form action={deleteVisitAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="visitId" value={visit.id} />
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
                Agrega al menos un hijo y empareja al otro progenitor desde tu Perfil antes de poder agregar visitas.
              </p>
            ) : (
              <form action={createVisitAction} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="as" value={as ?? ""} />
                <input
                  name="title"
                  autoComplete="off"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ej. Ir al cine, Cumpleaños de la prima..."
                  className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    name="childId"
                    required
                    className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
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
                    className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                  >
                    {familyMembers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === parentId ? "Tú" : p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="overflow-hidden rounded-md border border-subtle bg-card">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={selectedDayKey}
                    className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="time"
                    name="startTime"
                    required
                    className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                  />
                  <input
                    type="time"
                    name="endTime"
                    required
                    className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                  />
                </div>
                <select name="placeId" className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink">
                  <option value="">Sin lugar específico</option>
                  {meetingPlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink"
                >
                  Agregar visita
                </button>
              </form>
            )}
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Fechas importantes" accent="bg-sea" Icon={FlagIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">
              Cumpleaños, ciclo escolar, o cualquier recordatorio — puede durar 1 día, una semana o un mes.
            </p>

            {importantDates.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {importantDates
                  .slice()
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
                  .map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2 text-base text-ink"
                    >
                      <span>
                        {formatDay(parseDateKeyLocal(d.startDate))}
                        {d.startDate !== d.endDate && ` – ${formatDay(parseDateKeyLocal(d.endDate))}`} · {d.title}
                        {d.childId && ` · ${childName(d.childId)}`}
                      </span>
                      <form action={deleteImportantDateAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="importantDateId" value={d.id} />
                        <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                          Quitar
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            )}

            <form action={createImportantDateAction} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="as" value={as ?? ""} />
              <input
                name="title"
                autoComplete="off"
                required
                minLength={2}
                maxLength={120}
                placeholder="Ej. Cumpleaños de Juan, Inicio de ciclo escolar..."
                className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
              <select name="childId" className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink">
                <option value="">Sin hijo específico</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                  <input type="date" name="startDate" required defaultValue={selectedDayKey} className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink" />
                </div>
                <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                  <input type="date" name="endDate" required defaultValue={selectedDayKey} className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink" />
                </div>
              </div>
              <SubmitButton pendingText="Agregando…" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
                Agregar fecha importante
              </SubmitButton>
            </form>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Vacaciones" accent="bg-dawn" Icon={PinIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">
              Casa de cada progenitor, parque, cine, o un viaje con hotel — los que agregues aquí aparecen al crear un slot o una visita.
            </p>

            {meetingPlaces.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {meetingPlaces.map((place) => (
                  <li key={place.id} className="rounded-md bg-sand px-3 py-2 text-base text-ink">
                    <div className="flex items-center justify-between gap-2">
                      <span>📍 {place.name}</span>
                      <form action={deleteMeetingPlaceAction}>
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="placeId" value={place.id} />
                        <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                          Quitar
                        </button>
                      </form>
                    </div>
                    {place.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dawn bg-dawn/40 px-3 py-1 text-xs font-semibold text-ink"
                      >
                        📍 Ver en mapa
                      </a>
                    )}
                    {(place.hotelCheckIn || place.hotelCheckOut) && (
                      <p className="mt-1 text-xs text-ink-soft">
                        Hotel: {place.hotelCheckIn ?? "?"} – {place.hotelCheckOut ?? "?"}
                      </p>
                    )}
                    {place.contacts && <p className="mt-1 text-xs text-ink-soft">Contactos: {place.contacts}</p>}
                    {place.itinerary && <p className="mt-1 text-xs text-ink-soft">Itinerario: {place.itinerary}</p>}

                    <details className="mt-2 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="cursor-pointer text-xs font-medium text-ink-soft">Editar</summary>
                      <form action={updateMeetingPlaceAction} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="as" value={as ?? ""} />
                        <input type="hidden" name="placeId" value={place.id} />
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={80}
                          defaultValue={place.name}
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                        />
                        <input
                          name="address"
                          placeholder="Dirección (opcional)"
                          defaultValue={place.address ?? ""}
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                            <input
                              type="date"
                              name="hotelCheckIn"
                              defaultValue={place.hotelCheckIn ?? ""}
                              className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
                            />
                          </div>
                          <div className="flex-1 overflow-hidden rounded-md border border-subtle bg-card">
                            <input
                              type="date"
                              name="hotelCheckOut"
                              defaultValue={place.hotelCheckOut ?? ""}
                              className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
                            />
                          </div>
                        </div>
                        <textarea
                          name="contacts"
                          rows={2}
                          placeholder="Contactos (opcional)"
                          defaultValue={place.contacts ?? ""}
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                        />
                        <textarea
                          name="itinerary"
                          rows={3}
                          placeholder="Itinerario (opcional)"
                          defaultValue={place.itinerary ?? ""}
                          className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
                        />
                        <button type="submit" className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink">
                          Guardar cambios
                        </button>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}

            <form action={createMeetingPlaceAction} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="as" value={as ?? ""} />
              <input
                name="name"
                autoComplete="off"
                required
                minLength={2}
                maxLength={80}
                placeholder="Ej. Casa de Progenitor A, Hotel Playa Sol..."
                className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
              <input
                name="address"
                placeholder="Dirección (opcional)"
                className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
              />
              <SubmitButton pendingText="Agregando…" className="self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
                Agregar
              </SubmitButton>
            </form>
          </div>
        </details>
      </div>

      <AppNav active="Calendario" />
    </div>
  );
}
