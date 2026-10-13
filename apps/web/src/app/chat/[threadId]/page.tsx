import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { topicAvatarClass } from "@/lib/chatAvatar";
import { MessageComposer } from "./MessageComposer";
import { renameThreadAction, sealThreadAction } from "./actions";
import { AppNav } from "@/components/AppNav";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

// "Etc/GMT+6" (nota: el signo va al revés de lo intuitivo en estas zonas
// IANA — "+6" significa UTC-6), no "America/Mexico_City". México eliminó
// el horario de verano en 2022 y quedó fijo en UTC-6 todo el año, pero esa
// zona con nombre depende de que el runtime tenga la regla de DST al día;
// un offset fijo no depende de esa regla y nunca se puede desactualizar.
const MX_TIME_ZONE = "Etc/GMT+6";

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: MX_TIME_ZONE });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MX_TIME_ZONE,
  });
}

function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: MX_TIME_ZONE,
  });
}

function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: MX_TIME_ZONE,
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: MX_TIME_ZONE });
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

  const [threads, messages, children, familyMembers] = await Promise.all([
    chat.listThreads(parentId),
    chat.listMessages(parentId, threadId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);
  const thread = threads.find((t) => t.id === threadId);
  const childName = children.find((c) => c.id === thread?.childId)?.fullName ?? null;
  const senderName = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor");

  // Un chip por cada día con mensajes — "buscar por fecha" pedido por la
  // clienta. Son anchors (#dia-KEY) a los separadores que ya se renderizan
  // entre mensajes, no una búsqueda de texto.
  const distinctDays = [...new Set(messages.map((m) => dayKey(m.createdAt)))];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-sand">
      <div className="sticky top-0 z-10 border-b border-subtle bg-card shadow-ambient">
        <div className="flex items-center gap-3 px-4 py-3">
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{thread?.topic ?? "Hilo"}</p>
            <p className="truncate text-xs text-ink-soft">{childName ?? "General"}</p>
          </div>
          <Link
            href={`/chat/${threadId}/export${as === "b" ? "?as=b" : ""}`}
            className="flex-shrink-0 rounded-full border border-subtle px-3 py-1.5 text-xs font-medium text-ink"
          >
            Exportar
          </Link>
        </div>

        <details className="border-t border-subtle px-4 py-2 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer text-xs font-medium text-ink-soft">Cambiar título del hilo</summary>
          <form action={renameThreadAction} className="mt-2 flex gap-2">
            <input type="hidden" name="as" value={as ?? ""} />
            <input type="hidden" name="threadId" value={threadId} />
            <input
              name="topic"
              defaultValue={thread?.topic ?? ""}
              required
              minLength={2}
              maxLength={60}
              className="flex-1 rounded-md border border-subtle bg-card px-3 py-1.5 text-base text-ink outline-none focus:ring-2 focus:ring-orange/40"
            />
            <button type="submit" className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink">
              Guardar
            </button>
          </form>
        </details>

        {thread && messages.length > 0 && (
          <div className="border-t border-subtle px-4 py-2.5">
            {thread.sealedAt && thread.sealedMessageCount >= messages.length ? (
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                  <span aria-hidden="true">🔒</span> Sellado · {thread.sealedMessageCount} mensajes · {formatFullDate(thread.sealedAt)}
                </p>
              </div>
            ) : (
              <form action={sealThreadAction} className="flex items-center justify-between gap-2">
                <input type="hidden" name="as" value={as ?? ""} />
                <input type="hidden" name="threadId" value={threadId} />
                <p className="text-xs text-ink-soft">
                  {thread.sealedAt
                    ? `Sellado hace ${messages.length - thread.sealedMessageCount} mensaje${messages.length - thread.sealedMessageCount === 1 ? "" : "s"} — hay mensajes nuevos sin sellar.`
                    : "Esta conversación no está sellada todavía."}
                </p>
                <button
                  type="submit"
                  className="flex-shrink-0 rounded-full bg-purple px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  {thread.sealedAt ? "Volver a sellar" : "Sellar conversación"}
                </button>
              </form>
            )}
            {thread.merkleRoot && (
              <p className="mt-1 break-all font-mono text-[10px] text-ink-faint" title={thread.merkleRoot}>
                Raíz Merkle: {truncateHash(thread.merkleRoot)}
              </p>
            )}
          </div>
        )}

        {distinctDays.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-t border-subtle px-4 py-2">
            {distinctDays.map((key) => {
              const sample = messages.find((m) => dayKey(m.createdAt) === key)!;
              return (
                <a
                  key={key}
                  href={`#dia-${key}`}
                  className="flex-shrink-0 rounded-full border border-subtle bg-sand px-3 py-1 text-xs font-medium text-ink-soft"
                >
                  {formatDayShort(sample.createdAt)}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {isDemoMode && (
        <p className="mx-4 mt-3 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — escribiendo como Progenitor {as === "b" ? "B" : "A"}.
        </p>
      )}

      <div className="flex flex-1 flex-col gap-2 px-4 pt-4 pb-[calc(16rem+env(safe-area-inset-bottom))]">
        {messages.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay mensajes en este hilo.</p>}
        {messages.map((message, index) => {
          const isMine = message.senderId === parentId;
          const initial = senderName(message.senderId).charAt(0).toUpperCase();
          const showDaySeparator = index === 0 || dayKey(messages[index - 1].createdAt) !== dayKey(message.createdAt);
          const avatar = (
            <span
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center self-end rounded-full text-[11px] font-bold text-ink ${
                isMine ? "bg-orange" : "bg-sky"
              }`}
            >
              {initial}
            </span>
          );
          return (
            <div key={message.id} className="flex flex-col gap-2">
              {showDaySeparator && (
                <p id={`dia-${dayKey(message.createdAt)}`} className="my-2 scroll-mt-32 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {formatDayLabel(message.createdAt)}
                </p>
              )}
              <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                {!isMine && avatar}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine ? "bg-orange" : "border border-subtle bg-card"}`}
                >
                  {!isMine && <p className="text-xs font-semibold text-ink-soft">{senderName(message.senderId)}</p>}
                  {message.attachmentUrl && (
                    <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mb-1 block">
                      <img
                        src={message.attachmentUrl}
                        alt="Foto adjunta"
                        className="max-h-60 w-full rounded-lg object-cover"
                      />
                    </a>
                  )}
                  <p className="break-all text-sm text-ink">{message.body}</p>
                  <p className={`mt-1 text-right text-[10px] ${isMine ? "text-ink/60" : "text-ink-faint"}`}>
                    {formatTime(message.createdAt)}
                  </p>
                  <p
                    className={`text-right font-mono text-[9px] ${isMine ? "text-ink/50" : "text-ink-faint"}`}
                    title={`SHA-256: ${message.sha256Hex}`}
                  >
                    🔒 {truncateHash(message.sha256Hex)}
                  </p>
                </div>
                {isMine && avatar}
              </div>
            </div>
          );
        })}
      </div>

      {/* fixed (no sticky): sticky solo "pega" el composer cuando el scroll
          lo empuja hasta el offset — con pocos mensajes nunca llega a
          engancharse y el composer queda flotando a media pantalla, que es
          justo lo que reportó la clienta. fixed lo clava siempre en el
          mismo lugar, pegado arriba del AppNav (bottom: 7.5rem, el mismo
          valor que reserva el resto de la app para el nav), sin importar
          cuántos mensajes haya o cuánto se haya scrolleado. */}
      <div
        className="fixed inset-x-0 z-10 mx-auto max-w-2xl bg-sand px-4 pb-6 pt-2"
        style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom))" }}
      >
        <MessageComposer threadId={threadId} as={as ?? ""} />
      </div>

      <AppNav active="Chat" />
    </div>
  );
}
