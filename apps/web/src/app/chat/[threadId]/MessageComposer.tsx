"use client";

import { useState } from "react";
import type { ToneAnalysis } from "@alba/core";
import { checkToneAction, sendMessageAction } from "./actions";

const TONE_BORDER: Record<ToneAnalysis["level"], string> = {
  neutral: "border-subtle",
  tenso: "border-orange",
  hostil: "border-danger",
};

// El banner solo se renderiza cuando analysis no es "neutral" (ver
// handleSubmit), pero se tipa completo para que coincida con TONE_BORDER.
const TONE_BANNER: Record<ToneAnalysis["level"], string> = {
  neutral: "border-orange bg-dawn",
  tenso: "border-orange bg-dawn",
  hostil: "border-danger bg-danger/10",
};

export function MessageComposer({ threadId, as }: { threadId: string; as: string }) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [analysis, setAnalysis] = useState<ToneAnalysis | null>(null);
  const [sending, setSending] = useState(false);

  async function send(finalBody: string) {
    setSending(true);
    const formData = new FormData();
    formData.set("threadId", threadId);
    formData.set("as", as);
    formData.set("body", finalBody);
    if (photo) formData.set("file", photo);
    await sendMessageAction(formData);
    setBody("");
    setPhoto(null);
    setAnalysis(null);
    setSending(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !photo) return;

    // El Tone Meter solo tiene sentido si hay texto — una foto sola (sin
    // caption) se manda directo, no hay nada que analizar.
    if (!body.trim()) {
      await send("");
      return;
    }

    setChecking(true);
    const result = await checkToneAction(body);
    setChecking(false);

    if (result.level === "neutral") {
      await send(body);
    } else {
      setAnalysis(result);
    }
  }

  const borderClass = analysis ? TONE_BORDER[analysis.level] : "border-subtle";

  return (
    <div className="mt-4">
      {analysis && (
        <div className={`mb-3 rounded-lg border p-4 ${TONE_BANNER[analysis.level]}`}>
          <p className="text-sm font-semibold text-ink">
            {analysis.level === "hostil" ? "⚠️ Tono hostil detectado" : "Tono tenso detectado"}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-ink-soft">Original</p>
          <p className="mt-1 rounded-md bg-card px-3 py-2 text-sm text-ink">{body}</p>
          {analysis.suggestion && (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-ink-soft">Sugerido</p>
              <p className="mt-1 rounded-md bg-sea px-3 py-2 text-sm text-ink">{analysis.suggestion}</p>
            </>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => send(body)}
              className="flex-1 rounded-full border border-subtle bg-card px-3 py-2 text-sm font-medium text-ink"
            >
              Enviar original
            </button>
            {analysis.suggestion && (
              <button
                type="button"
                disabled={sending}
                onClick={() => send(analysis.suggestion!)}
                className="flex-1 rounded-full bg-orange px-3 py-2 text-sm font-semibold text-ink"
              >
                Usar sugerido
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAnalysis(null)}
            className="mt-2 text-xs font-medium text-ink-soft underline"
          >
            Seguir editando
          </button>
        </div>
      )}

      {photo && (
        <div className="mb-2 flex items-center gap-2 rounded-full border border-subtle bg-card px-3 py-1.5 text-xs text-ink">
          <span className="truncate">📷 {photo.name}</span>
          <button type="button" onClick={() => setPhoto(null)} className="font-semibold text-danger">
            Quitar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-subtle bg-card text-ink-soft">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <rect x="2.5" y="4.5" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="7.2" cy="8.7" r="1.3" fill="currentColor" />
            <path d="M3 14l4.5-4 3 2.8L14 9l3 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </label>
        <input
          name="body"
          autoComplete="off"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribir mensaje…"
          className={`flex-1 rounded-full border-2 bg-card px-4 py-3 text-sm text-ink ${borderClass}`}
        />
        <button
          type="submit"
          disabled={checking || sending}
          aria-label={checking ? "Revisando tono" : "Enviar"}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-orange text-ink disabled:opacity-60"
        >
          {checking ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          ) : (
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 translate-x-[-1px]" aria-hidden="true">
              <path
                d="M3 10l14-7-5 7 5 7-14-7z"
                fill="currentColor"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
