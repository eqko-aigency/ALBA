"use client";

import { useState } from "react";
import type { ToneAnalysis } from "@alba/core";
import { checkToneAction, sendMessageAction } from "./actions";

const TONE_BORDER: Record<ToneAnalysis["level"], string> = {
  neutral: "border-subtle",
  tenso: "border-orange",
  hostil: "border-danger",
};

const TONE_PILL: Record<Exclude<ToneAnalysis["level"], "neutral">, string> = {
  tenso: "bg-dawn text-orange-deep",
  hostil: "bg-danger/15 text-danger",
};

const TONE_PILL_LABEL: Record<Exclude<ToneAnalysis["level"], "neutral">, string> = {
  tenso: "⚠ Tono tenso detectado",
  hostil: "⚠ Tono hostil detectado",
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
    <div className="mt-4 rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
      {analysis && analysis.level !== "neutral" && (
        <div className="mb-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONE_PILL[analysis.level]}`}>
            {TONE_PILL_LABEL[analysis.level]}
          </span>

          <div className="mt-2 rounded-xl border border-purple/30 bg-purple/10 p-4">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-purple">
              <span aria-hidden="true">✦</span> ALBA sugiere
            </p>
            <p className="mt-2 text-sm text-ink">{analysis.suggestion ?? body}</p>

            <div className="mt-3 flex gap-2">
              {analysis.suggestion && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => send(analysis.suggestion!)}
                  className="flex-1 rounded-full bg-purple px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                >
                  Usar sugerencia
                </button>
              )}
              <button
                type="button"
                disabled={sending}
                onClick={() => send(body)}
                className="flex-1 rounded-full border border-purple/40 bg-card px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
              >
                Ignorar
              </button>
            </div>
          </div>
        </div>
      )}

      {photo && (
        <div className="mb-2 flex items-center gap-2 rounded-full border border-subtle bg-sand px-3 py-1.5 text-xs text-ink">
          <span className="truncate">📷 {photo.name}</span>
          <button type="button" onClick={() => setPhoto(null)} className="font-semibold text-danger">
            Quitar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-subtle bg-sand text-ink-soft">
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
          // text-base (16px), no text-sm (14px): en iOS Safari, un input con
          // letra menor a 16px dispara el zoom automático del navegador al
          // enfocarlo (y zoom hacia afuera al salir) — eso es el "parpadeo"
          // feo al abrir el teclado. focus:outline-none + ring de marca
          // reemplaza el contorno azul nativo del navegador.
          className={`flex-1 rounded-full border-2 bg-sand px-4 py-3 text-base text-ink outline-none focus:ring-2 focus:ring-orange/40 ${borderClass}`}
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
              <path d="M3 10l14-7-5 7 5 7-14-7z" fill="currentColor" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
