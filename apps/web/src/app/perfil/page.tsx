import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { LogoutButton } from "@/components/LogoutButton";
import { createChildAction, updateChildAction } from "./actions";
import { SaveProfileForm } from "./SaveProfileForm";

export default async function PerfilPage() {
  const { pairing, parentId } = await getRequestContext();
  const [profile, children] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — editando como Progenitor A.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Mi perfil</h1>

      <SaveProfileForm initialFullName={profile?.fullName ?? ""} />

      <h2 className="mt-10 text-lg font-semibold tracking-tight text-ink">Hijos vinculados</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {children.length === 0 && (
          <p className="text-sm text-ink-soft">Todavía no hay hijos registrados — agrega el primero abajo.</p>
        )}
        {children.map((child) => (
          <li key={child.id} className="rounded-lg border border-subtle bg-card p-5 shadow-ambient">
            <form action={updateChildAction} className="flex flex-col gap-3">
              <input type="hidden" name="childId" value={child.id} />
              <label className="text-sm font-medium text-ink">
                Nombre completo
                <input
                  name="childFullName"
                  autoComplete="off"
                  required
                  minLength={2}
                  defaultValue={child.fullName}
                  className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="text-sm font-medium text-ink">
                Fecha de nacimiento
                <input
                  name="childBirthDate"
                  type="date"
                  autoComplete="off"
                  required
                  defaultValue={child.birthDate}
                  className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
                />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" className="self-start rounded-full border border-subtle px-3 py-1.5 text-sm font-medium text-ink">
                  Guardar cambios
                </button>
                <Link href={`/perfil/hijo/${child.id}`} className="text-sm font-medium text-purple underline">
                  Contactos, salud y notas →
                </Link>
              </div>
            </form>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Agregar hijo/a</h2>
        <form action={createChildAction} className="mt-3 flex flex-col gap-3">
          <label className="text-sm font-medium text-ink">
            Nombre completo
            <input
              name="childFullName"
              autoComplete="off"
              required
              minLength={2}
              className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Fecha de nacimiento
            <input
              name="childBirthDate"
              type="date"
              autoComplete="off"
              required
              className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink"
          >
            Agregar hijo/a
          </button>
        </form>
      </section>

      <div className="mt-10 border-t border-subtle pt-6">
        <LogoutButton />
      </div>

      <AppNav active="Perfil" />
    </div>
  );
}
