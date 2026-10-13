import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { LogoutButton } from "@/components/LogoutButton";
import { BellIcon, UsageModeIcon, UserIcon } from "@/components/icons";
import { createChildAction } from "./actions";
import { SaveProfileForm } from "./SaveProfileForm";
import { PushToggle } from "./PushToggle";
import { setUsageModeAction } from "@/app/onboarding/actions";

const CHILD_ACCENTS = ["bg-salmon", "bg-sky", "bg-dawn", "bg-purple"];

function formatBirthDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

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

      {/* Acordeón: nada queda visible hasta que lo tocas — pedido explícito
          de la clienta en vez del menú anterior, que solo bajaba la
          pantalla a una sección que ya estaba siempre expandida. */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-salmon text-ink">
              <UserIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-ink">Mi información</span>
            <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">→</span>
          </summary>
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <SaveProfileForm initialFullName={profile?.fullName ?? ""} />
          </div>
        </details>

        <details className="group border-t border-subtle">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky text-ink">
              <UsageModeIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-ink">Cómo uso ALBA</span>
            <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">→</span>
          </summary>
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">
              {profile?.usageMode === "bilateral"
                ? "Configurada para que la usen los dos progenitores."
                : "Configurada para que la uses solo tú, por ahora."}
            </p>
            <form action={setUsageModeAction} className="mt-3">
              <input type="hidden" name="usageMode" value={profile?.usageMode === "bilateral" ? "unilateral" : "bilateral"} />
              <button type="submit" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
                {profile?.usageMode === "bilateral" ? "Cambiar a solo yo" : "Invitar al otro progenitor"}
              </button>
            </form>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-dawn text-ink">
              <BellIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-ink">Notificaciones</span>
            <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">→</span>
          </summary>
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <PushToggle />
          </div>
        </details>
      </div>

      {/* Antes cada hijo/a vivía como una tarjeta con el formulario de
          nombre/fecha abierto de una — se veía recargado y duplicaba lo que
          ya existe en su propia página. Ahora es un renglón simple que
          lleva a esa página, donde viven nombre/fecha junto con el resto
          (contactos, salud, escuela, notas). */}
      <h2 className="mt-10 text-lg font-semibold tracking-tight text-ink">Hijos vinculados</h2>
      {children.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">Todavía no hay hijos registrados — agrega el primero abajo.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
          {children.map((child, i) => (
            <Link
              key={child.id}
              href={`/perfil/hijo/${child.id}`}
              className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-subtle" : ""}`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-ink ${CHILD_ACCENTS[i % CHILD_ACCENTS.length]}`}
              >
                {child.fullName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{child.fullName}</span>
                <span className="block text-xs text-ink-soft">{formatBirthDate(child.birthDate)}</span>
              </span>
              <span className="ml-auto flex-shrink-0 text-ink-faint" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}

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
            <div className="mt-1 w-full overflow-hidden rounded-md border border-subtle bg-card">
              <input
                name="childBirthDate"
                type="date"
                autoComplete="off"
                required
                className="w-full min-w-0 bg-card px-3 py-2 text-sm text-ink"
              />
            </div>
          </label>
          <button
            type="submit"
            className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink"
          >
            Agregar hijo/a
          </button>
        </form>
      </section>

      <div className="mt-6 border-t border-subtle pt-6">
        <LogoutButton />
      </div>

      <AppNav active="Perfil" />
    </div>
  );
}
