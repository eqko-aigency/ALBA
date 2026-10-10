import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { BovedaIcon, CalendarIcon, ChatIcon, ClockIcon, GastosIcon } from "@/components/icons";
import type { ComponentType } from "react";

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(reference: Date): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const QUICK_LINKS: { href: string; title: string; description: string; accent: string; Icon: ComponentType<{ className?: string }> }[] = [
  { href: "/chat", title: "Chat", description: "Habla con el otro progenitor.", accent: "bg-salmon", Icon: ChatIcon },
  { href: "/calendario", title: "Calendario", description: "Confirma check-in/check-out.", accent: "bg-sky", Icon: CalendarIcon },
  { href: "/gastos", title: "Gastos", description: "Registra y aprueba gastos.", accent: "bg-dawn", Icon: GastosIcon },
  { href: "/boveda", title: "Bóveda", description: "Documentos y evidencia.", accent: "bg-purple", Icon: BovedaIcon },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, chat, custody, expenses, documents, parentId } = await getRequestContext(as);

  await pairing.getOrCreateMyFamily(parentId);

  const weekStart = isoDateLocal(startOfWeek(new Date()));

  const [profile, children, threads, agreement, todayEvents, balance, expenseList, documentList] =
    await Promise.all([
      pairing.getProfile(parentId),
      pairing.getMyChildren(parentId),
      chat.listThreads(parentId),
      custody.getMyAgreement(parentId),
      custody.listEventsForWeek(parentId, weekStart),
      expenses.getBalance(parentId),
      expenses.listExpenses(parentId),
      documents.listDocuments(parentId),
    ]);

  const childName = (id: string) => children.find((c) => c.id === id)?.fullName ?? "Hijo/a";
  const firstName = profile?.fullName?.split(" ")[0] ?? "";

  const today = new Date();
  const todaySlots = agreement.slots.filter((s) => s.weekday === today.getDay());
  const todayStatus = todaySlots.map((slot) => {
    const scheduledIn = new Date(today);
    const [h, m] = slot.startTime.split(":").map(Number);
    scheduledIn.setHours(h ?? 0, m ?? 0, 0, 0);
    const confirmed = todayEvents.some(
      (e) => e.type === "checkin" && e.childId === slot.childId && e.parentId === slot.parentId && e.confirmedAt
    );
    return { slot, confirmed };
  });

  const pendingForMe = expenseList.filter(
    (e) => e.status === "pending_approval" && e.paidByParentId !== parentId
  ).length;
  const pendingDocs = documentList.filter((d) => d.anchorStatus === "pending").length;
  const anchoredDocs = documentList.length - pendingDocs;

  const balanceLabel =
    balance.otherParentId === null
      ? "Empareja al otro progenitor para ver el balance"
      : balance.amountMxnOwedByCaller > 0
        ? `Le debes ${MXN.format(balance.amountMxnOwedByCaller)}`
        : balance.amountMxnOwedByCaller < 0
          ? `Te deben ${MXN.format(Math.abs(balance.amountMxnOwedByCaller))}`
          : "Están a mano";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/dashboard" : "/dashboard?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Hola{firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="mt-2 text-ink-soft">Esto es lo que está pasando en tu familia hoy.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange text-ink">
            <ClockIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Hoy</p>
          {todayStatus.length === 0 ? (
            <p className="mt-1 text-sm font-medium text-ink">Sin eventos</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {todayStatus.map(({ slot, confirmed }, i) => (
                <li key={i} className="text-sm font-medium text-ink">
                  {confirmed ? "✓" : "○"} {childName(slot.childId)} {slot.startTime}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky text-ink">
            <GastosIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Balance de gastos</p>
          <p className="mt-1 text-sm font-medium text-ink">{balanceLabel}</p>
          {pendingForMe > 0 && (
            <p className="mt-1 text-xs font-semibold text-orange-deep">{pendingForMe} por aprobar</p>
          )}
        </div>

        <div className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple text-ink">
            <BovedaIcon />
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Documentos</p>
          <p className="mt-1 text-sm font-medium text-ink">
            {documentList.length === 0
              ? "Ninguno todavía"
              : `${anchoredDocs} anclado${anchoredDocs === 1 ? "" : "s"} · ${pendingDocs} pendiente${pendingDocs === 1 ? "" : "s"}`}
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

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ink-soft">Ir a</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {QUICK_LINKS.map(({ Icon, ...link }) => (
          <Link
            key={link.href}
            href={as === "b" ? `${link.href}?as=b` : link.href}
            className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-ink ${link.accent}`}>
              <Icon />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{link.title}</p>
            <p className="mt-1 text-xs text-ink-soft">{link.description}</p>
          </Link>
        ))}
      </div>

      <Link
        href="/registro"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-subtle bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        Invitar al otro progenitor o agregar hijos
        <span aria-hidden="true">→</span>
      </Link>

      <AppNav active="Dashboard" />
    </div>
  );
}
