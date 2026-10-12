import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { PrintButton } from "./PrintButton";

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

/**
 * Vista de transcripción lista para imprimir/guardar como PDF (pedido
 * explícito de la clienta: "que se pueda exportar el chat para que cuente
 * como prueba en juicio"). No genera un PDF server-side — usa window.print()
 * del navegador (PrintButton), que alcanza para este caso y no agrega una
 * librería de PDF nueva al proyecto.
 */
export default async function ExportThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { threadId } = await params;
  const { as } = await searchParams;
  const { chat, pairing, parentId } = await getRequestContext(as);

  const [threads, messages, familyMembers] = await Promise.all([
    chat.listThreads(parentId),
    chat.listMessages(parentId, threadId),
    pairing.listFamilyMembers(parentId),
  ]);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) notFound();

  const senderName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-sand px-6 py-10 print:bg-white print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/chat/${threadId}${as === "b" ? "?as=b" : ""}`} className="text-sm font-medium text-ink-soft underline">
          ← Volver al chat
        </Link>
        <PrintButton />
      </div>

      <h1 className="mt-6 text-xl font-semibold text-ink print:mt-0">Transcripción — {thread.topic}</h1>
      <p className="mt-1 text-xs text-ink-soft">
        Exportado el {formatFull(new Date().toISOString())} · {messages.length} mensaje{messages.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 flex flex-col gap-3 border-t border-subtle pt-4 print:border-ink/20">
        {messages.length === 0 && <p className="text-sm text-ink-soft">Este hilo todavía no tiene mensajes.</p>}
        {messages.map((m) => (
          <div key={m.id} className="border-b border-subtle pb-3 text-sm print:border-ink/10">
            <p className="font-semibold text-ink">
              {senderName(m.senderId)} <span className="font-normal text-ink-faint">— {formatFull(m.createdAt)}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink">{m.body}</p>
            {m.attachmentUrl && <p className="mt-1 break-all text-xs text-ink-soft">Imagen adjunta: {m.attachmentUrl}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
