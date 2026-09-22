import Link from "next/link";
import { getCurrentParentId, getRepositories } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { MessageComposer } from "./MessageComposer";

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { threadId } = await params;
  const { as } = await searchParams;
  const { chat, pairing } = await getRepositories();
  const parentId = await getCurrentParentId(as);

  const [threads, messages, children] = await Promise.all([
    chat.listThreads(parentId),
    chat.listMessages(parentId, threadId),
    pairing.getMyChildren(parentId),
  ]);
  const thread = threads.find((t) => t.id === threadId);
  const childName = children.find((c) => c.id === thread?.childId)?.fullName ?? null;

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

      <div className="mt-4 flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{thread?.topic ?? "Hilo"}</h1>
        <span className="rounded-full bg-sea px-2.5 py-1 text-xs font-medium text-ink">
          {childName ?? "General"}
        </span>
      </div>

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

      <MessageComposer threadId={threadId} as={as ?? ""} />
    </div>
  );
}
