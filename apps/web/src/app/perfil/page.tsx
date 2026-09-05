import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID, isDemoMode } from "@/lib/demoSession";
import { upsertProfileAction, updateChildAction } from "./actions";

export default async function PerfilPage() {
  const [profile, children] = await Promise.all([
    pairingRepository.getProfile(DEMO_PARENT_A_ID),
    pairingRepository.getMyChildren(DEMO_PARENT_A_ID),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16 font-sans">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Modo de prueba local — editando como Progenitor A.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>

      <form action={upsertProfileAction} className="mt-6 flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <label className="text-sm font-medium">
          Nombre completo
          <input
            name="parentFullName"
            autoComplete="off"
            required
            minLength={2}
            defaultValue={profile?.fullName ?? ""}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
          />
        </label>
        <button type="submit" className="mt-2 self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Guardar
        </button>
      </form>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Hijos vinculados</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {children.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Todavía no hay hijos registrados — agrégalos desde /registro.
          </p>
        )}
        {children.map((child) => (
          <li key={child.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <form action={updateChildAction} className="flex flex-col gap-3">
              <input type="hidden" name="childId" value={child.id} />
              <label className="text-sm font-medium">
                Nombre completo
                <input
                  name="childFullName"
                  autoComplete="off"
                  required
                  minLength={2}
                  defaultValue={child.fullName}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
                />
              </label>
              <label className="text-sm font-medium">
                Fecha de nacimiento
                <input
                  name="childBirthDate"
                  type="date"
                  autoComplete="off"
                  required
                  defaultValue={child.birthDate}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent"
                />
              </label>
              <button type="submit" className="self-start rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700">
                Guardar cambios
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
