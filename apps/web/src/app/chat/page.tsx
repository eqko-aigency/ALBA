import Link from "next/link";
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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16 bg-bruma">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-ambar bg-ambar/20 px-4 py-2 text-sm text-noche">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/chat" : "/chat?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-noche">Chat</h1>
      <p className="mt-2 text-tinta/80">Hilos por tema, compartidos con el otro progenitor.</p>

      <form action={createThreadAction} className="mt-6 flex gap-2">
        <input type="hidden" name="as" value={as ?? ""} />
        <input
          name="topic"
          autoComplete="off"
          required
          minLength={2}
          placeholder="Nuevo hilo (ej. Gastos escolares)"
          className="flex-1 rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta"
        />
        <button type="submit" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-[#4A1B0C]">
          Crear
        </button>
      </form>

      <ul className="mt-6 flex flex-1 flex-col gap-2">
        {threads.length === 0 && <p className="text-sm text-tinta/70">Todavía no hay hilos — crea el primero.</p>}
        {threads.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/chat/${thread.id}${as === "b" ? "?as=b" : ""}`}
              className="block rounded-lg bg-cielo/40 px-4 py-3 font-medium text-noche"
            >
              {thread.topic}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <AppNav active="Chat" />
      </div>
    </div>
  );
}
