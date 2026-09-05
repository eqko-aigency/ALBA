import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID, isDemoMode } from "@/lib/demoSession";
import { createChildAction, createInvitationAction } from "./actions";

export default async function RegistroPage() {
  const children = await pairingRepository.getMyChildren(DEMO_PARENT_A_ID);
  const childrenWithInvitations = await Promise.all(
    children.map(async (child) => ({
      child,
      invitations: await pairingRepository.listPendingInvitations(DEMO_PARENT_A_ID, child.id),
    }))
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16 font-sans">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Modo de prueba local — sin Supabase conectado. Los datos viven en memoria y se
          pierden al reiniciar el servidor.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight">Registro y emparejamiento</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Progenitor A: agrega a tu hijo o hija y genera un link de invitación para el otro
        progenitor.
      </p>

      <form action={createChildAction} className="mt-8 flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <label className="text-sm font-medium">
          Nombre completo
          <input name="fullName" required minLength={2} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent" />
        </label>
        <label className="text-sm font-medium">
          Fecha de nacimiento
          <input name="birthDate" type="date" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-transparent" />
        </label>
        <button type="submit" className="mt-2 self-start rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Agregar hijo/a
        </button>
      </form>

      <ul className="mt-8 flex flex-col gap-4">
        {childrenWithInvitations.map(({ child, invitations }) => (
          <li key={child.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="font-medium">{child.fullName}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nacimiento: {child.birthDate}
            </p>

            {invitations.length > 0 ? (
              invitations.map((inv) => (
                <p key={inv.id} className="mt-3 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  Link de invitación: /invitacion/{inv.token}
                </p>
              ))
            ) : (
              <form action={createInvitationAction} className="mt-3">
                <input type="hidden" name="childId" value={child.id} />
                <button type="submit" className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700">
                  Generar link de invitación
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
