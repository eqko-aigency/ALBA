import Link from "next/link";
import { CHAT_TOPICS } from "@alba/core";
import { chatRepository } from "@/lib/repository";
import { isDemoMode, resolveDemoParentId } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { createThreadAction } from "./actions";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const parentId = resolveDemoParentId(as);
  const threads = await chatRepository.listThreads(parentId);
  const availableTopics = CHAT_TOPICS.filter((topic) => !threads.some((t) => t.topic === topic));

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
      <p className="mt-2 text-ink-soft">Categorías fijas, compartidas con el otro progenitor.</p>

      {availableTopics.length > 0 && (
        <form action={createThreadAction} className="mt-6 flex gap-2">
          <input type="hidden" name="as" value={as ?? ""} />
          <select
            name="topic"
            required
            className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          >
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
            Abrir hilo
          </button>
        </form>
      )}

      <ul className="mt-6 flex flex-1 flex-col gap-2">
        {threads.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay hilos — abre el primero.</p>}
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/chat/${thread.id}${as === "b" ? "?as=b" : ""}`}
              className="block rounded-lg border border-subtle bg-card px-4 py-3 font-medium text-ink shadow-ambient"
            >
              {thread.topic}
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
