import Link from "next/link";
import { CHAT_TOPICS } from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { topicAvatarClass } from "@/lib/chatAvatar";
import { createThreadAction } from "./actions";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { chat, pairing, parentId } = await getRequestContext(as);
  const [threads, children] = await Promise.all([
    chat.listThreads(parentId),
    pairing.getMyChildren(parentId),
  ]);
  const childName = (childId: string | null) => children.find((c) => c.id === childId)?.fullName ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/chat" : "/chat?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Mensajes</h1>
      <p className="mt-2 text-ink-soft">Categoría fija + hijo — compartido con el otro progenitor.</p>

      <details className="mt-6 rounded-xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-ink">+ Nuevo hilo</summary>
        <form action={createThreadAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="as" value={as ?? ""} />
          <select
            name="topic"
            required
            className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          >
            {CHAT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          <select
            name="childId"
            className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          >
            <option value="">General (toda la familia)</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.fullName}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
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

      <div className="mt-8">
        <AppNav active="Acuerdo" />
      </div>
    </div>
  );
}
