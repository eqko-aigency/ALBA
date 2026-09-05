import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID, isDemoMode } from "@/lib/demoSession";
import { upsertProfileAction, updateChildAction } from "./actions";

export default async function PerfilPage() {
  const [profile, children] = await Promise.all([
    pairingRepository.getProfile(DEMO_PARENT_A_ID),
    pairingRepository.getMyChildren(DEMO_PARENT_A_ID),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16 bg-bruma">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-ambar bg-ambar/20 px-4 py-2 text-sm text-noche">
          Modo de prueba local — editando como Progenitor A.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-noche">Mi perfil</h1>

      <form action={upsertProfileAction} className="mt-6 flex flex-col gap-3 rounded-lg border border-tinta/10 bg-white/50 p-5">
        <label className="text-sm font-medium text-tinta">
          Nombre completo
          <input
            name="parentFullName"
            autoComplete="off"
            required
            minLength={2}
            defaultValue={profile?.fullName ?? ""}
            className="mt-1 w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta"
          />
        </label>
        <button type="submit" className="mt-2 self-start rounded-full bg-coral px-4 py-2 text-sm font-semibold text-[#4A1B0C]">
          Guardar
        </button>
      </form>

      <h2 className="mt-10 text-lg font-semibold tracking-tight text-noche">Hijos vinculados</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {children.length === 0 && (
          <p className="text-sm text-tinta/70">Todavía no hay hijos registrados — agrégalos desde /registro.</p>
        )}
        {children.map((child) => (
          <li key={child.id} className="rounded-lg border border-tinta/10 bg-white/50 p-5">
            <form action={updateChildAction} className="flex flex-col gap-3">
              <input type="hidden" name="childId" value={child.id} />
              <label className="text-sm font-medium text-tinta">
                Nombre completo
                <input
                  name="childFullName"
                  autoComplete="off"
                  required
                  minLength={2}
                  defaultValue={child.fullName}
                  className="mt-1 w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta"
                />
              </label>
              <label className="text-sm font-medium text-tinta">
                Fecha de nacimiento
                <input
                  name="childBirthDate"
                  type="date"
                  autoComplete="off"
                  required
                  defaultValue={child.birthDate}
                  className="mt-1 w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta"
                />
              </label>
              <button type="submit" className="self-start rounded-full border border-tinta/20 px-3 py-1.5 text-sm font-medium text-noche">
                Guardar cambios
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
