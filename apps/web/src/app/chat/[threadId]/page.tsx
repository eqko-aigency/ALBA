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
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16 bg-bruma">
      <Link href={`/chat${as === "b" ? "?as=b" : ""}`} className="text-sm font-medium text-coral underline">
        ← Todos los hilos
      </Link>

      {isDemoMode && (
        <p className="mt-4 rounded-md border border-ambar bg-ambar/20 px-4 py-2 text-sm text-noche">
          Modo de prueba local — escribiendo como Progenitor {as === "b" ? "B" : "A"}.
        </p>
      )}

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-noche">{thread?.topic ?? "Hilo"}</h1>

      <div className="mt-4 flex flex-1 flex-col gap-2">
        {messages.length === 0 && <p className="text-sm text-tinta/70">Todavía no hay mensajes en este hilo.</p>}
        {messages.map((message) => {
          const isMine = message.senderId === parentId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isMine ? "bg-coral text-[#4A1B0C]" : "bg-cielo/50 text-noche"
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
          className="flex-1 rounded-full border border-tinta/20 bg-white px-4 py-2 text-sm text-tinta"
        />
        <button type="submit" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-[#4A1B0C]">
          Enviar
        </button>
      </form>
    </div>
  );
}
