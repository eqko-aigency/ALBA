import Link from "next/link";
import { CHAT_TOPICS } from "@alba/core";
import { getCurrentParentId, getRepositories } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { createThreadAction } from "./actions";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { chat, pairing } = await getRepositories();
  const parentId = await getCurrentParentId(as);
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

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Chat por temas</h1>
      <p className="mt-2 text-ink-soft">Categoría fija + hijo — compartido con el otro progenitor.</p>

      <form action={createThreadAction} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="as" value={as ?? ""} />
        <select name="topic" required className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
          {CHAT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
        <select name="childId" className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
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

      <ul className="mt-6 flex flex-1 flex-col gap-2">
        {threads.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay hilos — abre el primero.</p>}
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/chat/${thread.id}${as === "b" ? "?as=b" : ""}`}
              className="flex items-center justify-between rounded-lg border border-subtle bg-card px-4 py-3 shadow-ambient"
            >
              <span className="font-medium text-ink">{thread.topic}</span>
              <span className="rounded-full bg-sea px-2.5 py-1 text-xs font-medium text-ink">
                {childName(thread.childId) ?? "General"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <AppNav active="Acuerdo" />
      </div>
    </div>
  );
}
