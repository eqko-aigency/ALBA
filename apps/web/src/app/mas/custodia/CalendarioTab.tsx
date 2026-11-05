import type { Child, CustodyAgreement, Document, Parent } from "@alba/core";
import { ScheduleAiAssistant } from "./ScheduleAiAssistant";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function CalendarioTab({
  as,
  parentId,
  agreement,
  kids,
  familyMembers,
  analyzableDocuments,
}: {
  as?: string;
  parentId: string;
  agreement: CustodyAgreement;
  kids: Child[];
  familyMembers: Parent[];
  analyzableDocuments: Document[];
}) {
  const childName = (id: string) => kids.find((c) => c.id === id)?.fullName ?? "—";
  const parentName = (id: string) => (id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "—");
  const assistantProps = { as, parentId, kids, familyMembers, analyzableDocuments: analyzableDocuments.map((d) => ({ id: d.id, title: d.title })) };

  if (agreement.slots.length === 0) {
    return (
      <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mx-auto text-ink-faint">
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="mt-3 text-base font-bold text-ink">Aún no has configurado la custodia</p>
        <p className="mt-1 text-sm text-ink-soft">Crea el calendario de custodia con ayuda de la IA.</p>
        <div className="mt-4 text-left">
          <ScheduleAiAssistant {...assistantProps} />
        </div>
      </div>
    );
  }

  const byChild = new Map<string, CustodyAgreement["slots"]>();
  for (const slot of agreement.slots) {
    const list = byChild.get(slot.childId) ?? [];
    list.push(slot);
    byChild.set(slot.childId, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byChild.entries()].map(([childId, slots]) => (
        <div key={childId} className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient">
          <p className="text-sm font-bold text-ink">Esta semana con {childName(childId)}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {[...slots]
              .sort((a, b) => a.weekday - b.weekday)
              .map((slot, idx) => (
                <li key={idx} className="text-sm text-ink-soft">
                  {WEEKDAY_LABELS[slot.weekday]} {slot.startTime}–{slot.endTime} con{" "}
                  <strong className="text-ink">{parentName(slot.parentId)}</strong>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <details className="group rounded-2xl border border-subtle bg-card px-4 py-3 shadow-ambient">
        <summary className="cursor-pointer text-xs font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
          Volver a analizar con IA →
        </summary>
        <div className="mt-3">
          <ScheduleAiAssistant {...assistantProps} />
        </div>
      </details>
    </div>
  );
}
