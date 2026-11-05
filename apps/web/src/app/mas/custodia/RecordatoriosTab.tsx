import type { Child, CustodyRepository, Document } from "@alba/core";
import { BellIcon } from "@/components/icons";
import { deleteImportantDateAction } from "@/app/calendario/actions";
import { ReminderAiAssistant } from "./ReminderAiAssistant";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKeyLocal(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export async function RecordatoriosTab({
  as,
  parentId,
  kids,
  analyzableDocuments,
  custody,
}: {
  as?: string;
  parentId: string;
  kids: Child[];
  analyzableDocuments: Document[];
  custody: CustodyRepository;
}) {
  const today = new Date();
  const start = isoDateLocal(today);
  const end = isoDateLocal(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
  const reminders = await custody.listImportantDatesForRange(parentId, start, end);

  const childName = (id: string | null) => (id ? kids.find((c) => c.id === id)?.fullName ?? null : null);
  const assistantDocuments = analyzableDocuments.map((d) => ({ id: d.id, title: d.title }));

  return (
    <div className="flex flex-col gap-5">
      {reminders.length === 0 ? (
        <div className="rounded-2xl border border-subtle bg-card p-6 text-center shadow-ambient">
          <BellIcon className="mx-auto h-10 w-10 text-ink-faint" />
          <p className="mt-3 text-base font-bold text-ink">Aún no hay recordatorios</p>
          <p className="mt-1 text-sm text-ink-soft">Analiza tu convenio para detectar obligaciones, fechas y avisos.</p>
          <div className="mt-4 text-left">
            <ReminderAiAssistant as={as} kids={kids} analyzableDocuments={assistantDocuments} />
          </div>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {reminders
              .slice()
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-subtle bg-card px-3.5 py-2.5 shadow-ambient">
                  <span className="text-sm text-ink">
                    {formatDay(parseDateKeyLocal(d.startDate))}
                    {d.startDate !== d.endDate && ` – ${formatDay(parseDateKeyLocal(d.endDate))}`} · {d.title}
                    {childName(d.childId) && ` · ${childName(d.childId)}`}
                  </span>
                  <form action={deleteImportantDateAction}>
                    <input type="hidden" name="as" value={as ?? ""} />
                    <input type="hidden" name="importantDateId" value={d.id} />
                    <button type="submit" className="shrink-0 text-xs font-medium text-danger underline">
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
          </ul>
          <details className="group rounded-2xl border border-subtle bg-card px-4 py-3 shadow-ambient">
            <summary className="cursor-pointer text-xs font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
              Volver a analizar →
            </summary>
            <div className="mt-3">
              <ReminderAiAssistant as={as} kids={kids} analyzableDocuments={assistantDocuments} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
