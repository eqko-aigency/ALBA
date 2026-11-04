import Link from "next/link";
import { CHAT_TOPICS } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { SectionIntroModal } from "@/components/SectionIntroModal";
import { QuickActionFab } from "@/components/QuickActionFab";
import { topicAvatarClass } from "@/lib/chatAvatar";
import { createThreadAction } from "./actions";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { chat, pairing, parentId } = await getRequestContext(as);
  const [threads, children, profile] = await Promise.all([
    chat.listThreads(parentId),
    pairing.getMyChildren(parentId),
    pairing.getProfile(parentId),
  ]);
  const childName = (childId: string | null) => children.find((c) => c.id === childId)?.fullName ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/chat" : "/chat?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Mensajes</h1>
        <SectionIntroModal
          sectionKey="chat"
          as={as}
          alreadySeen={profile?.seenIntros?.includes("chat") ?? false}
          hero={<ChatIntroHero />}
          title="Chat"
          description="Habla con el otro progenitor con herramientas que bajan la tensión y dejan constancia de lo que se dice."
          points={[
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="#f79a7a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
              iconBgClass: "bg-orange/20",
              title: "Tono cuidado",
              description: "Antes de enviar, revisamos el tono. Si hay tensión, te sugerimos una versión más neutral — tú decides si la usas.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="#a4bed5" strokeWidth="1.8" />
                  <path d="M8 10.5V7.8a4 4 0 118 0v2.7" stroke="#a4bed5" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
              iconBgClass: "bg-sky/20",
              title: "Queda con respaldo",
              description: "Cada mensaje genera su propia huella digital. Puedes sellar la conversación como evidencia si alguna vez la necesitas.",
            },
            {
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 4.5h7.5L18 8v10.5A1.5 1.5 0 0116.5 20h-9A1.5 1.5 0 016 18.5v-12A1.5 1.5 0 017 4.5z"
                    stroke="#bb889b"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
              iconBgClass: "bg-purple/20",
              title: "Organiza por hilos",
              description: "Crea un hilo por tema para que cada conversación quede junta y sea fácil de encontrar después.",
            },
          ]}
        />
      </div>
      <p className="mt-2 text-ink-soft">Categoría fija + hijo — compartido con el otro progenitor.</p>

      <details id="nuevo-hilo" className="mt-6 rounded-xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-ink">+ Nuevo hilo</summary>
        <form action={createThreadAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="as" value={as ?? ""} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="topic"
              className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
            >
              {CHAT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
            <select
              name="childId"
              className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
            >
              <option value="">General (toda la familia)</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.fullName}
                </option>
              ))}
            </select>
          </div>
          <input
            name="customTopic"
            placeholder="O escribe tu propia categoría (opcional)"
            maxLength={60}
            className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
          />
          <button
            type="submit"
            className="self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink"
          >
            Abrir hilo
          </button>
        </form>
      </details>

      <div className="mt-6 overflow-hidden rounded-xl border border-subtle bg-card shadow-ambient">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Todavía no hay hilos — abre el primero.</p>
        ) : (
          threads.map((thread, i) => (
            <Link
              key={thread.id}
              href={`/chat/${thread.id}${as === "b" ? "?as=b" : ""}`}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-subtle" : ""}`}
            >
              <span
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-ink ${topicAvatarClass(thread.topic)}`}
              >
                {thread.topic.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{thread.topic}</span>
                <span className="block truncate text-xs text-ink-soft">
                  {childName(thread.childId) ?? "General"}
                </span>
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4 flex-shrink-0 text-ink-faint"
                aria-hidden="true"
              >
                <path
                  d="M7.5 15l5-5-5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ))
        )}
      </div>

      <QuickActionFab
        actions={[
          {
            label: "Nuevo mensaje",
            href: `/chat${as === "b" ? "?as=b" : ""}#nuevo-hilo`,
            iconBgClass: "bg-sea",
            icon: (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
                  stroke="#3a332e"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
        ]}
      />

      <AppNav active="Chat" />
    </div>
  );
}

function ChatIntroHero() {
  return (
    <div className="relative h-[88px] w-full rounded-[18px]" style={{ background: "#f7dbb7" }}>
      <div className="absolute left-[18px] top-5 max-w-[150px] rounded-[14px_14px_14px_4px] bg-white px-3.5 py-2.5 text-xs text-ink shadow-md">
        ¿Nos vemos a las 5?
      </div>
      <div className="absolute left-[66px] top-16 max-w-[140px] rounded-[14px_14px_4px_14px] bg-orange px-3.5 py-2.5 text-xs text-ink shadow-md">
        Sí, perfecto
      </div>
      <div className="absolute right-4 top-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-success shadow-md">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
