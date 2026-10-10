"use client";

import { useState } from "react";

export function CopyInvitationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <p className="flex-1 break-all font-mono text-xs text-ink-faint">{url}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-full border border-subtle px-3 py-1.5 text-xs font-medium text-ink"
      >
        {copied ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
