import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { confirmVerbalAgreementAction, createVerbalAgreementAction } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AcuerdosVerbalesPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { verbalAgreements, pairing, parentId } = await getRequestContext(as);

  const [agreements, children, familyMembers] = await Promise.all([
    verbalAgreements.listVerbalAgreements(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";
  const childLabel = (childId: string | null) =>
    childId ? (children.find((c) => c.id === childId)?.fullName ?? "Hijo/a") : "General";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/boveda/acuerdos" : "/boveda/acuerdos?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <Link
        href={`/boveda${as === "b" ? "?as=b" : ""}`}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-subtle bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <span aria-hidden="true">←</span> Volver a Bóveda
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Acuerdos verbales</h1>
      <p className="mt-2 text-ink-soft">
        Un registro de lo que acordaron de palabra (teléfono, en persona) — no se puede editar después de guardado.
      </p>

      <section className="mt-6 overflow-hidden rounded-xl border border-subtle bg-card shadow-ambient">
        {agreements.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Todavía no hay acuerdos registrados.</p>
        ) : (
          agreements.map((agreement, i) => {
            const canConfirm = agreement.createdByParentId !== parentId && !agreement.confirmedAt;
            return (
              <div key={agreement.id} className={`p-4 ${i > 0 ? "border-t border-subtle" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-block rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                      {childLabel(agreement.childId)}
                    </span>
                    <p className="mt-1.5 break-all text-sm text-ink">{agreement.description}</p>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      Acordado el {formatDate(agreement.agreedAt)} · registrado por {parentName(agreement.createdByParentId)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      agreement.confirmedAt ? "bg-success/20 text-ink" : "border border-orange bg-dawn text-ink"
                    }`}
                  >
                    {agreement.confirmedAt ? "Confirmado ✓" : "Sin confirmar"}
                  </span>
                </div>

                {agreement.confirmedAt && (
                  <p className="mt-2 text-xs text-ink-faint">
                    Confirmado por {parentName(agreement.confirmedByParentId!)} el {formatDate(agreement.confirmedAt.slice(0, 10))}
                  </p>
                )}

                {canConfirm && (
                  <form action={confirmVerbalAgreementAction} className="mt-2">
                    <input type="hidden" name="as" value={as ?? ""} />
                    <input type="hidden" name="agreementId" value={agreement.id} />
                    <SubmitButton pendingText="Confirmando…" className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-ink">
                      Confirmar que yo también lo recuerdo así
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="mt-8 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Nuevo acuerdo</h2>

        <form action={createVerbalAgreementAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="as" value={as ?? ""} />

          <textarea
            name="description"
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            placeholder="Ej. Acordamos por teléfono que el viernes 17 el pickup se mueve a las 6pm por la junta escolar."
            className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="date"
              name="agreedAt"
              required
              defaultValue={todayLocal()}
              className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />
            {children.length > 0 && (
              <select name="childId" className="flex-1 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink">
                <option value="">General (toda la familia)</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <SubmitButton pendingText="Registrando…" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
            Registrar acuerdo
          </SubmitButton>
        </form>
      </section>

      <AppNav active="Bóveda" />
    </div>
  );
}
