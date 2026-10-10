import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { topicAvatarClass } from "@/lib/chatAvatar";
import { MessageComposer } from "./MessageComposer";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { threadId } = await params;
  const { as } = await searchParams;
  const { chat, pairing, parentId } = await getRequestContext(as);

  const [threads, messages, children] = await Promise.all([
    chat.listThreads(parentId),
    chat.listMessages(parentId, threadId),
    pairing.getMyChildren(parentId),
  ]);
  const thread = threads.find((t) => t.id === threadId);
  const childName = children.find((c) => c.id === thread?.childId)?.fullName ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-subtle bg-card px-4 py-3 shadow-ambient">
        <Link
          href={`/chat${as === "b" ? "?as=b" : ""}`}
          aria-label="Todos los hilos"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-ink"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M12.5 15l-5-5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-ink ${topicAvatarClass(thread?.topic ?? "")}`}
        >
          {(thread?.topic ?? "?").slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">{thread?.topic ?? "Hilo"}</p>
          <p className="truncate text-xs text-ink-soft">{childName ?? "General"}</p>
        </div>
      </div>

      {isDemoMode && (
        <p className="mx-4 mt-3 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — escribiendo como Progenitor {as === "b" ? "B" : "A"}.
        </p>
      )}

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        {messages.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay mensajes en este hilo.</p>}
        {messages.map((message) => {
          const isMine = message.senderId === parentId;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? "bg-orange" : "bg-card shadow-ambient"}`}
              >
                <p className="text-sm text-ink">{message.body}</p>
                <p className={`mt-1 text-right text-[10px] ${isMine ? "text-ink/60" : "text-ink-faint"}`}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 bg-sand px-4 pb-6 pt-2">
        <MessageComposer threadId={threadId} as={as ?? ""} />
      </div>
    </div>
  );
}
