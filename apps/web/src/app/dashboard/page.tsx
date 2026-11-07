import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { findComplianceIssues, type CustodySlot } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { SectionIntroModal } from "@/components/SectionIntroModal";
import { QuickActionFab } from "@/components/QuickActionFab";
import { confirmCheckinAction } from "@/app/calendario/actions";
import { buildNotifications, formatRelativeTime, NOTIFICATION_ICON_CLASS, NOTIFICATION_ICON_SYMBOL } from "@/lib/notifications";
import { BovedaIcon, CalendarIcon, ChatIcon, ClockIcon, GastosIcon } from "@/components/icons";
import { nextOnboardingStep } from "@/lib/onboardingGate";
import { AVATAR_SRC } from "@/lib/avatars";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const MONTH_LABEL = new Intl.DateTimeFormat("es-MX", { month: "long" });

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
  const result = new Date(date);
  result.setHours(h ?? 0, m ?? 0, 0, 0);
  return result;
}

function monthLabelCapitalized(d: Date): string {
  const label = MONTH_LABEL.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Próxima ocurrencia de CUALQUIER slot del convenio desde `from` (incluido),
 * mirando hasta 30 días adelante — el convenio es solo un patrón semanal
 * recurrente, no fechas puntuales, así que "próxima visita" se deriva
 * recorriendo días hacia adelante hasta encontrar un weekday con slot. */
function findNextOccurrence(
  slots: CustodySlot[],
  from: Date
): { date: Date; slot: CustodySlot } | null {
  for (let i = 0; i <= 30; i++) {
    const day = addDays(from, i);
    const daySlots = [...slots.filter((s) => s.weekday === day.getDay())].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    for (const slot of daySlots) {
      if (i === 0 && combineDateAndTime(day, slot.startTime) < from) continue;
      return { date: day, slot };
    }
  }
  return null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, chat, custody, expenses, documents, verbalAgreements, pension, parentId } = await getRequestContext(as);

  // getOrCreateMyFamily va sola y primero porque es la única con side-effect
  // (crea la fila de family/family_members si falta) — custody.getMyAgreement
  // de abajo tira error si family_id es null, así que necesita que la familia
  // ya exista. profile/children/familyMembers NO tienen esa dependencia
  // (resuelven family_id con su propio SELECT y devuelven null/[] si no
  // existe, no tiran), así que no hace falta separarlas en su propia tanda:
  // van junto con todo lo demás en un solo Promise.all. Antes esto eran 2
  // Promise.all secuenciales completos — un round-trip extra en cada carga
  // de Dashboard — solo para evitar gastar el segundo batch en un usuario
  // que de todos modos iba a ser redirigido al wizard. Con family ya creada
  // de antemano, ese batch ya no puede fallar aunque corra para ese usuario;
  // el único costo es desperdiciar esas queries en el caso raro (primer
  // login, antes de completar onboarding) en vez del caso común (cada
  // navegación normal de un usuario ya onboardeado).
  await pairing.getOrCreateMyFamily(parentId);

  const now = new Date();
  const todayKey = isoDateLocal(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthKeyPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const notificationsSince = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const [
    profile,
    children,
    familyMembers,
    threads,
    agreement,
    monthEvents,
    balance,
    expenseList,
    documentList,
    agreements,
    pensionPayments,
    recentMessages,
  ] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    chat.listThreads(parentId),
    custody.getMyAgreement(parentId),
    custody.listEventsForRange(parentId, isoDateLocal(monthStart), isoDateLocal(addDays(monthEnd, 1))),
    expenses.getBalance(parentId),
    expenses.listExpenses(parentId),
    documents.listDocuments(parentId),
    verbalAgreements.listVerbalAgreements(parentId),
    pension.listPayments(parentId),
    chat.listRecentMessages(parentId, notificationsSince.toISOString()),
  ]);

  const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;
  const pendingStep = await nextOnboardingStep({ profile, hasChildren: children.length > 0, otherParent });
  if (pendingStep) {
    redirect(as === "b" ? `/onboarding/${pendingStep}?as=b` : `/onboarding/${pendingStep}`);
  }

  const onboardingSteps = [
    { label: "Agrega a tu hijo/a", done: children.length > 0, href: "/perfil" },
    { label: "Invita al otro progenitor", done: otherParent !== null, href: `/onboarding/invitar${as === "b" ? "?as=b" : ""}` },
    { label: "Registra un gasto compartido", done: expenseList.length > 0, href: `/gastos${as === "b" ? "?as=b" : ""}` },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const showOnboardingCard = completedSteps < onboardingSteps.length;

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const firstName = profile?.fullName?.split(" ")[0] ?? "";

  // monthEvents ya está cargado para las cifras del mes de más abajo — se
  // reutiliza acá para el contador de la campanita en vez de pedir de
  // nuevo los últimos 30 días; en la práctica casi siempre son los mismos
  // eventos, y evita otra consulta más solo para el badge.
  const nameOf = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor");
  const threadTopicOf = (threadId: string) => threads.find((t) => t.id === threadId)?.topic ?? "Chat";
  const notifications = buildNotifications({
    parentId,
    nameOf,
    childNameOf: (id) => (id ? childName(id) : "General"),
    threadTopicOf,
    expenses: expenseList,
    pensionPayments,
    documents: documentList,
    messages: recentMessages,
    verbalAgreements: agreements,
    custodyEvents: monthEvents,
  });
  const lastSeen = profile?.lastNotificationsSeenAt ? new Date(profile.lastNotificationsSeenAt) : null;
  const unseenCount = notifications.filter((n) => !lastSeen || new Date(n.createdAt) > lastSeen).length;

  // Cifras del mes: cuántos check-ins estaban esperados (por el patrón
  // recurrente del convenio) vs. cuántos se confirmaron de verdad.
  let expectedVisits = 0;
  for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) {
    expectedVisits += agreement.slots.filter((s) => s.weekday === d.getDay()).length;
  }
  const confirmedVisits = monthEvents.filter(
    (e) => e.type === "checkin" && e.confirmedAt && e.scheduledAt.startsWith(monthKeyPrefix)
  ).length;
  const visitsPct = expectedVisits > 0 ? Math.min(100, Math.round((confirmedVisits / expectedVisits) * 100)) : 0;

  const pendingForMe = expenseList.filter(
    (e) => e.status === "pending_approval" && e.paidByParentId !== parentId
  ).length;
  const pendingDocs = documentList.filter((d) => d.anchorStatus === "pending").length;
  const pendingAgreements = agreements.filter((a) => a.createdByParentId !== parentId && !a.confirmedAt).length;
  const todayIssues = findComplianceIssues(agreement, monthEvents, now).filter(
    (issue) => issue.type === "missed_checkin" && issue.slot.parentId === parentId
  );

  const balanceLabel =
    balance.otherParentId === null
      ? "Empareja al otro progenitor para ver el balance"
      : balance.amountMxnOwedByCaller > 0
        ? `Le debes ${MXN.format(balance.amountMxnOwedByCaller)}`
        : balance.amountMxnOwedByCaller < 0
          ? `Te deben ${MXN.format(Math.abs(balance.amountMxnOwedByCaller))}`
          : "Están a mano";

  const next = findNextOccurrence(agreement.slots, now);
  const nextIsToday = next ? isoDateLocal(next.date) === todayKey : false;
  const nextIsMine = next ? next.slot.parentId === parentId : false;
  // Diferencia en días calendario completos, no en milisegundos crudos —
  // mezclar un Date local (next.date) con uno parseado desde un string
  // "YYYY-MM-DD" (que el motor de JS interpreta como medianoche UTC) corría
  // el conteo en zonas horarias != UTC. Ambos lados se normalizan a
  // medianoche LOCAL antes de restar.
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilNext = next
    ? Math.round(
        (new Date(next.date.getFullYear(), next.date.getMonth(), next.date.getDate()).getTime() -
          todayMidnight.getTime()) /
          86400000
      )
    : null;
  const checkinEvent =
    next && nextIsToday
      ? monthEvents.find(
          (e) =>
            e.type === "checkin" &&
            e.childId === next.slot.childId &&
            e.parentId === next.slot.parentId &&
            e.scheduledAt === combineDateAndTime(next.date, next.slot.startTime).toISOString()
        )
      : undefined;

  const alerts: { label: string; href: string }[] = [];
  if (todayIssues.length > 0) {
    alerts.push({
      label: `Check-in sin confirmar hoy${todayIssues[0] ? ` · ${childName(todayIssues[0].slot.childId)}` : ""}`,
      href: "/calendario",
    });
  }
  if (pendingForMe > 0) {
    alerts.push({ label: `${pendingForMe} gasto${pendingForMe === 1 ? "" : "s"} por aprobar`, href: "/gastos" });
  }
  if (pendingDocs > 0) {
    alerts.push({ label: `${pendingDocs} documento${pendingDocs === 1 ? "" : "s"} sin anclar`, href: "/boveda" });
  }
  if (pendingAgreements > 0) {
    alerts.push({
      label: `${pendingAgreements} acuerdo${pendingAgreements === 1 ? "" : "s"} verbal${pendingAgreements === 1 ? "" : "es"} sin confirmar`,
      href: "/boveda/acuerdos",
    });
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/dashboard" : "/dashboard?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={unseenCount} as={as} />

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <SectionIntroModal
          sectionKey="inicio"
          as={as}
          alreadySeen={profile?.seenIntros?.includes("inicio") ?? false}
          hero={<InicioIntroHero />}
          title="Inicio"
          description="Tu resumen del día: lo próximo en el calendario, el balance de gastos y lo último del chat, todo de un vistazo."
          points={[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="#a4bed5" strokeWidth="1.8" />
                  <path d="M4 9.5h16" stroke="#a4bed5" strokeWidth="1.8" />
                </svg>
              ),
              iconBgClass: "bg-sky/20",
              title: "Lo próximo primero",
              description: "Tu próxima visita o entrega siempre está arriba de todo.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" stroke="#f79a7a" strokeWidth="1.8" />
                  <path
                    d="M14.5 9.5c-.4-.8-1.3-1.3-2.5-1.3-1.5 0-2.7.8-2.7 2s1.2 1.8 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 7.3v9.4"
                    stroke="#f79a7a"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-orange/20",
              title: "Balance siempre visible",
              description: "Quién le debe a quién, sin tener que entrar a Gastos.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
                    stroke="#bb889b"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-purple/20",
              title: "Último mensaje a la mano",
              description: "Un vistazo a lo último que se dijeron, sin abrir Chat.",
            },
          ]}
        />
      </div>
      <p className="mt-1 text-ink-soft">Esto es lo que está pasando en tu familia hoy.</p>

      {children[0] && (
        <div className="mt-5 flex flex-col items-center gap-1.5">
          {children[0].avatarKey ? (
            <Image
              src={AVATAR_SRC[children[0].avatarKey]}
              alt={children[0].fullName}
              width={76}
              height={76}
              className="h-[76px] w-[76px] rounded-full border-[3px] border-orange object-cover"
              style={{ objectPosition: "center 15%" }}
            />
          ) : (
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-orange bg-dawn text-2xl font-bold text-ink">
              {children[0].fullName.slice(0, 1)}
            </span>
          )}
          <span className="text-sm font-bold text-ink">{children[0].fullName}</span>
        </div>
      )}

      {!otherParent && (
        <Link
          href={`/onboarding/invitar${as ? `?as=${as}` : ""}`}
          className="mt-6 block rounded-2xl border border-subtle bg-card p-4 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <p className="text-sm font-semibold text-ink">
            {profile?.usageMode === "bilateral"
              ? "Invita al otro progenitor para empezar a compartir"
              : "¿Quieres invitar al otro progenitor?"}
          </p>
          <p className="mt-1 text-xs text-ink-soft">Invitar ahora →</p>
        </Link>
      )}

      {/* Próxima visita — hero card */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-dawn to-salmon shadow-elevated">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/70">
            {next ? (nextIsToday ? "Hoy" : `Próxima visita · en ${daysUntilNext} día${daysUntilNext === 1 ? "" : "s"}`) : "Próxima visita"}
          </p>
          {next ? (
            <>
              <p className="mt-1 text-xl font-semibold text-ink">
                {next.date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                {next.slot.startTime}
              </p>
              <p className="mt-1 text-sm text-ink/80">
                {childName(next.slot.childId)} con {nextIsMine ? "Tú" : familyMembers.find((p) => p.id === next.slot.parentId)?.fullName ?? "el otro progenitor"}
              </p>
              {nextIsToday && nextIsMine && (
                <div className="mt-3">
                  {checkinEvent?.confirmedAt ? (
                    <span className="inline-block rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink">
                      ✓ Check-in confirmado
                    </span>
                  ) : (
                    <form action={confirmCheckinAction}>
                      <input type="hidden" name="as" value={as ?? ""} />
                      <input type="hidden" name="childId" value={next.slot.childId} />
                      <input
                        type="hidden"
                        name="scheduledAt"
                        value={combineDateAndTime(next.date, next.slot.startTime).toISOString()}
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient"
                      >
                        Check-in
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold text-ink">Sin visitas programadas</p>
              <Link href="/calendario" className="mt-3 inline-block rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient">
                Configurar convenio
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Primeros pasos */}
      {showOnboardingCard && (
        <div className="mt-6 rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-sm font-bold text-ink">Primeros pasos</p>
          <p className="mt-0.5 text-xs text-ink-soft">Completa esto para sacarle el máximo a ALBA.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full bg-orange"
              style={{ width: `${Math.round((completedSteps / onboardingSteps.length) * 100)}%` }}
            />
          </div>
          <div className="mt-3 flex flex-col">
            {onboardingSteps.map((step, i) => (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 py-2 ${
                  i < onboardingSteps.length - 1 ? "border-b border-subtle" : ""
                }`}
              >
                {step.done ? (
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-success">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="h-4 w-4 flex-shrink-0 rounded-full border-[1.6px] border-ink-faint" />
                )}
                {step.done ? (
                  <span className="flex-1 text-sm text-ink line-through opacity-60">{step.label}</span>
                ) : (
                  <Link href={step.href} className="flex flex-1 items-center justify-between text-sm text-ink">
                    {step.label}
                    <span className="text-ink-faint" aria-hidden="true">›</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Necesita tu atención */}
      {alerts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Necesita tu atención</h2>
          <div className="mt-2 flex flex-col gap-2">
            {alerts.map((alert) => (
              <Link
                key={alert.label}
                href={as === "b" ? `${alert.href}?as=b` : alert.href}
                className="flex items-center gap-3 rounded-xl border border-orange bg-dawn/40 px-4 py-3 text-sm font-medium text-ink"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange/20 text-ink">
                  !
                </span>
                {alert.label}
                <span className="ml-auto text-ink-faint" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Mes en cifras */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {monthLabelCapitalized(now)} en cifras
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange text-ink">
            <ClockIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Check-ins confirmados</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {confirmedVisits}/{expectedVisits}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-sand">
            <div className="h-1.5 rounded-full bg-success" style={{ width: `${visitsPct}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky text-ink">
            <GastosIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Balance de gastos</p>
          <p className="mt-1 text-sm font-medium text-ink">{balanceLabel}</p>
        </div>

        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple text-ink">
            <BovedaIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Documentos</p>
          <p className="mt-1 text-sm font-medium text-ink">
            {documentList.length === 0
              ? "Ninguno todavía"
              : `${documentList.length - pendingDocs} anclado${documentList.length - pendingDocs === 1 ? "" : "s"} · ${pendingDocs} pendiente${pendingDocs === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-salmon text-ink">
            <ChatIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Chats</p>
          <p className="mt-1 text-sm font-medium text-ink">
            {threads.length} hilo{threads.length === 1 ? "" : "s"} activo{threads.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Actividad reciente</h2>
        <Link href={as === "b" ? "/notificaciones?as=b" : "/notificaciones"} className="text-xs font-semibold text-orange">
          Ver todas →
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-subtle bg-card p-4 text-sm text-ink-soft">
            Todavía no hay actividad del otro progenitor para mostrar.
          </p>
        ) : (
          notifications.slice(0, 5).map((item) => {
            const isNew = !lastSeen || new Date(item.createdAt) > lastSeen;
            return (
              <Link
                key={item.id}
                href={as === "b" ? `${item.href}${item.href.includes("?") ? "&" : "?"}as=b` : item.href}
                className={`flex items-start gap-3 rounded-xl border bg-card p-4 shadow-ambient ${
                  isNew ? "border-orange" : "border-subtle"
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm text-ink ${NOTIFICATION_ICON_CLASS[item.icon]}`}
                >
                  {NOTIFICATION_ICON_SYMBOL[item.icon]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{item.title}</span>
                    <span className="flex-shrink-0 text-xs text-ink-faint">{formatRelativeTime(item.createdAt, now)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-soft">{item.subtitle}</span>
                </span>
                {isNew && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-orange" aria-hidden="true" />}
              </Link>
            );
          })
        )}
      </div>

      <QuickActionFab
        actions={[
          {
            label: "Nuevo evento",
            href: `/calendario${as === "b" ? "?as=b" : ""}#fecha-importante`,
            iconBgClass: "bg-dawn",
            icon: <CalendarIcon className="h-[19px] w-[19px] text-[#3a332e]" />,
          },
          {
            label: "Nuevo gasto",
            href: `/gastos${as === "b" ? "?as=b" : ""}#nuevo-gasto`,
            iconBgClass: "bg-orange",
            icon: <GastosIcon className="h-[19px] w-[19px] text-[#3a332e]" />,
          },
        ]}
      />

      <AppNav active="Inicio" />
    </div>
  );
}

function InicioIntroHero() {
  return (
    <div className="relative h-[88px] w-full rounded-[18px]" style={{ background: "#a4bed5" }}>
      <div className="absolute left-[18px] top-[18px] w-[150px] rounded-[14px] bg-white px-3.5 py-[11px] shadow-md">
        <p className="text-[10px] font-bold text-ink-soft">PRÓXIMA VISITA</p>
        <p className="mt-0.5 text-xs font-bold text-ink">Viernes 7, 17:00</p>
      </div>
      <div className="absolute bottom-3.5 right-4 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-orange shadow-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5"
            stroke="#3a332e"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
