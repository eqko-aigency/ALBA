"use client";

import { useState, useTransition } from "react";
import type { ReminderProposalItem } from "@alba/core";
import { confirmReminderProposalAction, proposeRemindersAction } from "./actions";

type ProposedReminder = ReminderProposalItem & { checked: boolean };

export function ReminderAiAssistant({
  as,
  kids,
  analyzableDocuments,
}: {
  as?: string;
  kids: { id: string; fullName: string }[];
  analyzableDocuments: { id: string; title: string }[];
}) {
  const [documentId, setDocumentId] = useState(analyzableDocuments[0]?.id ?? "");
  const [proposal, setProposal] = useState<ProposedReminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (analyzableDocuments.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        ¿Todavía no has subido ningún documento?{" "}
        <a href={`/boveda${as === "b" ? "?as=b" : ""}`} className="font-semibold text-salmon underline">
          Sube tu convenio en Bóveda
        </a>
        .
      </p>
    );
  }

  if (done) {
    return <p className="text-sm font-semibold text-success">✓ Recordatorios agregados.</p>;
  }

  function runAnalysis() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await proposeRemindersAction(documentId, as);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        if (result.reminders.length === 0) {
          setError("No pudimos detectar fechas en este documento — puedes intentar con otro.");
          return;
        }
        setProposal(result.reminders.map((r) => ({ ...r, checked: true })));
      } catch {
        setError("Algo salió mal — intenta de nuevo.");
      }
    });
  }

  function toggleReminder(idx: number) {
    setProposal((prev) => prev && prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));
  }

  function updateReminder(idx: number, patch: Partial<ReminderProposalItem>) {
    setProposal((prev) => prev && prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function confirm() {
    if (!proposal) return;
    const chosen = proposal.filter((r) => r.checked).map(({ checked, ...reminder }) => reminder);
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmReminderProposalAction(chosen, as);
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
          {isPending ? "Analizando…" : "Analizar mis documentos"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">Revisa lo que detectamos antes de agregarlo:</p>
      <ul className="flex flex-col gap-2">
        {proposal.map((reminder, idx) => (
          <li key={idx} className="rounded-xl border border-subtle bg-sand px-3 py-2.5">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={reminder.checked} onChange={() => toggleReminder(idx)} className="mt-1.5" />
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  value={reminder.title}
                  onChange={(e) => updateReminder(idx, { title: e.target.value })}
                  className="rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                />
                <select
                  value={reminder.childId ?? ""}
                  onChange={(e) => updateReminder(idx, { childId: e.target.value === "" ? null : e.target.value })}
                  className="rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">Sin hijo específico</option>
                  {kids.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <input
                    type="date"
                    value={reminder.startDate}
                    onChange={(e) => updateReminder(idx, { startDate: e.target.value })}
                    className="flex-1 rounded-md border border-subtle bg-card px-2 py-1.5 text-sm text-ink"
                  />
                  <input
                    type="date"
                    value={reminder.endDate}
                    onChange={(e) => updateReminder(idx, { endDate: e.target.value })}
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
        disabled={isPending || proposal.every((r) => !r.checked)}
        className="rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Agregar recordatorios"}
      </button>
    </div>
  );
}
