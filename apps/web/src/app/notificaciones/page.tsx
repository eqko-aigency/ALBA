import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { buildNotifications, formatRelativeTime, NOTIFICATION_ICON_CLASS, NOTIFICATION_ICON_SYMBOL } from "@/lib/notifications";
import { markNotificationsSeenAction } from "./actions";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, expenses, pension, documents, verbalAgreements, custody, chat, parentId } = await getRequestContext(as);

  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const rangeStart = isoDateLocal(since);
  const rangeEnd = isoDateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const [profile, children, familyMembers, expenseList, pensionPayments, documentList, agreements, custodyEvents, threads, messages] =
    await Promise.all([
      pairing.getProfile(parentId),
      pairing.getMyChildren(parentId),
      pairing.listFamilyMembers(parentId),
      expenses.listExpenses(parentId),
      pension.listPayments(parentId),
      documents.listDocuments(parentId),
      verbalAgreements.listVerbalAgreements(parentId),
      custody.listEventsForRange(parentId, rangeStart, rangeEnd),
      chat.listThreads(parentId),
      chat.listRecentMessages(parentId, since.toISOString()),
    ]);

  const nameOf = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor");
  const childNameOf = (id: string | null) => (id ? (children.find((c) => c.id === id)?.fullName ?? "Hijo/a") : "General");
  const threadTopicOf = (threadId: string) => threads.find((t) => t.id === threadId)?.topic ?? "Chat";

  const items = buildNotifications({
    parentId,
    nameOf,
    childNameOf,
    threadTopicOf,
    expenses: expenseList,
    pensionPayments,
    documents: documentList,
    verbalAgreements: agreements,
    custodyEvents,
    messages,
  });

  const lastSeen = profile?.lastNotificationsSeenAt ? new Date(profile.lastNotificationsSeenAt) : null;
  const unseenCount = items.filter((i) => !lastSeen || new Date(i.createdAt) > lastSeen).length;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/notificaciones" : "/notificaciones?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Notificaciones</h1>
        {unseenCount > 0 && (
          <form action={markNotificationsSeenAction}>
            <input type="hidden" name="as" value={as ?? ""} />
            <button type="submit" className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-semibold text-ink">
              Marcar todo como leído
            </button>
          </form>
        )}
      </div>
      <p className="mt-2 text-ink-soft">Actividad reciente de los últimos 30 días — la tuya no aparece acá.</p>

      <div className="mt-6 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-subtle bg-card p-4 text-sm text-ink-soft">
            Todavía no hay actividad del otro progenitor para mostrar.
          </p>
        ) : (
          items.map((item) => {
            const isNew = !lastSeen || new Date(item.createdAt) > lastSeen;
            return (
              <Link
                key={item.id}
                href={as === "b" ? `${item.href}${item.href.includes("?") ? "&" : "?"}as=b` : item.href}
                className={`flex items-start gap-3 rounded-xl border bg-card p-4 shadow-ambient ${
                  isNew ? "border-orange" : "border-subtle"
                }`}
              >
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm text-ink ${NOTIFICATION_ICON_CLASS[item.icon]}`}>
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

      <AppNav active="Dashboard" />
    </div>
  );
}
