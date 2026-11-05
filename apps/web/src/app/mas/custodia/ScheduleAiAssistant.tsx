"use client";

import { useState, useTransition } from "react";
import type { CustodyScheduleProposalSlot } from "@alba/core";
import { confirmScheduleProposalAction, proposeScheduleAction } from "./actions";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type ProposedSlot = CustodyScheduleProposalSlot & { checked: boolean };

export function ScheduleAiAssistant({
  as,
  parentId,
  kids,
  familyMembers,
  analyzableDocuments,
}: {
  as?: string;
  parentId: string;
  kids: { id: string; fullName: string }[];
  familyMembers: { id: string; fullName: string }[];
  analyzableDocuments: { id: string; title: string }[];
}) {
  const [documentId, setDocumentId] = useState(analyzableDocuments[0]?.id ?? "");
  const [proposal, setProposal] = useState<ProposedSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (kids.length === 0 || familyMembers.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Agrega al menos un hijo y empareja al otro progenitor desde tu Perfil antes de poder usar el asistente de IA.
      </p>
    );
  }

  if (analyzableDocuments.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Todavía no tienes un PDF o foto en Bóveda.{" "}
        <a href={`/boveda${as === "b" ? "?as=b" : ""}`} className="font-semibold text-salmon underline">
          Sube tu convenio ahí primero
        </a>
        .
      </p>
    );
  }

  if (done) {
    return <p className="text-sm font-semibold text-success">✓ Horarios agregados a tu convenio.</p>;
  }

  function runAnalysis() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await proposeScheduleAction(documentId, as);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if (result.slots.length === 0) {
          setError(
            "No pudimos detectar un horario de custodia en este documento — puedes intentar con otro o crear los horarios a mano en Calendario."
          );
          return;
        }
        setProposal(result.slots.map((s) => ({ ...s, checked: true })));
      } catch {
        setError("Algo salió mal — intenta de nuevo.");
      }
    });
  }

  function toggleSlot(idx: number) {
    setProposal((prev) => prev && prev.map((s, i) => (i === idx ? { ...s, checked: !s.checked } : s)));
  }

  function updateSlot(idx: number, patch: Partial<CustodyScheduleProposalSlot>) {
    setProposal((prev) => prev && prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function confirm() {
    if (!proposal) return;
    const chosen = proposal.filter((s) => s.checked).map(({ checked, ...slot }) => slot);
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmScheduleProposalAction(chosen, as);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDone(true);
      } catch {
        setError("Algo salió mal — intenta de nuevo.");
      }
    });
  }

  if (!proposal) {
    return (
      <div className="flex flex-col gap-2">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        >
          {analyzableDocuments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isPending}
          className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Analizando…" : "Configurar con IA"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">Revisa lo que detectamos antes de agregarlo a tu convenio:</p>
      <ul className="flex flex-col gap-2">
        {proposal.map((slot, idx) => (
          <li key={idx} className="rounded-xl border border-subtle bg-sand px-3 py-2.5">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={slot.checked} onChange={() => toggleSlot(idx)} className="mt-1.5" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <select
                    value={slot.childId}
                    onChange={(e) => updateSlot(idx, { childId: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={slot.parentId}
                    onChange={(e) => updateSlot(idx, { parentId: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {familyMembers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id === parentId ? "Tú" : p.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <select
                    value={slot.weekday}
                    onChange={(e) => updateSlot(idx, { weekday: Number(e.target.value) })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  >
                    {WEEKDAY_LABELS.map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                </div>
              </div>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={isPending || proposal.every((s) => !s.checked)}
        className="rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Agregar a mi convenio"}
      </button>
    </div>
  );
}
