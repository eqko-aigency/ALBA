import Link from "next/link";
import { chatRepository } from "@/lib/repository";
import { isDemoMode, resolveDemoParentId } from "@/lib/demoSession";
import { sendMessageAction } from "./actions";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { threadId } = await params;
  const { as } = await searchParams;
  const parentId = resolveDemoParentId(as);

  const [threads, messages] = await Promise.all([
    chatRepository.listThreads(parentId),
    chatRepository.listMessages(parentId, threadId),
  ]);
  const thread = threads.find((t) => t.id === threadId);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16 bg-sand">
      <Link href={`/chat${as === "b" ? "?as=b" : ""}`} className="text-sm font-medium text-purple underline">
        ← Todos los hilos
      </Link>

      {isDemoMode && (
        <p className="mt-4 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — escribiendo como Progenitor {as === "b" ? "B" : "A"}.
        </p>
      )}

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{thread?.topic ?? "Hilo"}</h1>

      <div className="mt-4 flex flex-1 flex-col gap-2">
        {messages.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay mensajes en este hilo.</p>}
        {messages.map((message) => {
          const isMine = message.senderId === parentId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[75%] rounded-lg px-4 py-2 text-sm text-ink ${
                  isMine ? "bg-orange" : "bg-sea"
                }`}
              >
                {message.body}
              </p>
            </div>
          );
        })}
      </div>

      <form action={sendMessageAction} className="mt-4 flex gap-2">
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="as" value={as ?? ""} />
        <input
          name="body"
          autoComplete="off"
          required
          placeholder="Escribir mensaje…"
          className="flex-1 rounded-full border border-subtle bg-card px-4 py-2 text-sm text-ink"
        />
        <button type="submit" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
          Enviar
        </button>
      </form>
    </div>
  );
}
