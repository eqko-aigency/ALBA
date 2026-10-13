import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { AppNav } from "@/components/AppNav";
import { SubmitButton } from "@/components/SubmitButton";
import { updateChildAction } from "../../actions";
import { ChildDetailsForm } from "./ChildDetailsForm";

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const { pairing, parentId } = await getRequestContext();
  const children = await pairing.getMyChildren(parentId);
  const child = children.find((c) => c.id === childId);

  if (!child) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      <Link
        href="/perfil"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-subtle bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <span aria-hidden="true">←</span> Volver a Perfil
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{child.fullName}</h1>
      <p className="mt-2 text-ink-soft">
        Datos que ayudan al otro progenitor (y a quien cuide a {child.fullName.split(" ")[0]}) a hacer bien su parte.
      </p>

      <section className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Datos básicos</h2>
        <form action={updateChildAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="childId" value={child.id} />
          <label className="text-sm font-medium text-ink">
            Nombre completo
            <input
              name="childFullName"
              autoComplete="off"
              required
              minLength={2}
              defaultValue={child.fullName}
              className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Fecha de nacimiento
            {/* iOS Safari a veces renderiza el control nativo de type="date"
                más ancho que su caja (ignora width:100%) — el borde/rounded
                vive en este wrapper con overflow-hidden en vez de en el
                input, así lo que Safari dibuje de más queda recortado y
                nunca se sale de la tarjeta, sea cual sea la causa exacta. */}
            <div className="mt-1 w-full overflow-hidden rounded-md border border-subtle bg-card">
              <input
                name="childBirthDate"
                type="date"
                autoComplete="off"
                required
                defaultValue={child.birthDate}
                className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
              />
            </div>
          </label>
          <SubmitButton pendingText="Guardando…" className="mt-1 self-start rounded-full border border-subtle px-4 py-2 text-sm font-semibold text-ink">
            Guardar cambios
          </SubmitButton>
        </form>
      </section>

      <ChildDetailsForm
        childId={child.id}
        initial={{
          contacts: child.contacts,
          healthProviders: child.healthProviders,
          schoolName: child.schoolName,
          schoolContacts: child.schoolContacts,
          allergies: child.allergies,
          notes: child.notes,
        }}
      />

      <AppNav active="Perfil" />
    </div>
  );
}
