"use client";

import { useEffect, useState } from "react";

function buildMessage(url: string): string {
  return `Te invito a coparentar conmigo en ALBA — entra a este link para vincularnos: ${url}`;
}

export function CopyInvitationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // navigator.share solo existe en navegadores con menú nativo de
  // compartir (celular, y Mac/Edge recientes) — en el resto (la mayoría
  // de desktop) no aparece, así que "Copiar" y WhatsApp siguen siendo las
  // opciones de respaldo.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    try {
      await navigator.share({ title: "Invitación a ALBA", text: buildMessage(url), url });
    } catch {
      // El usuario cerró el menú de compartir sin elegir nada — no es un error real.
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(buildMessage(url))}`;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="break-all font-mono text-xs text-ink-faint">{url}</p>
      <div className="flex flex-wrap items-center gap-2">
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="rounded-full bg-orange px-4 py-2 text-xs font-semibold text-ink"
          >
            Compartir
          </button>
        )}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-success/20 px-4 py-2 text-xs font-semibold text-ink"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-subtle px-4 py-2 text-xs font-medium text-ink"
        >
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
