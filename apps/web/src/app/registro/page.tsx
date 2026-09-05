import Link from "next/link";
import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_A_ID, isDemoMode } from "@/lib/demoSession";
import { createChildAction, createInvitationAction } from "./actions";

export default async function RegistroPage() {
  await pairingRepository.getOrCreateMyFamily(DEMO_PARENT_A_ID);
  const [pendingInvitations, children] = await Promise.all([
    pairingRepository.listPendingInvitations(DEMO_PARENT_A_ID),
    pairingRepository.getMyChildren(DEMO_PARENT_A_ID),
  ]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-16 bg-bruma">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-ambar bg-ambar/20 px-4 py-2 text-sm text-noche">
          Modo de prueba local — sin Supabase conectado. Los datos viven en memoria y se
          pierden al reiniciar el servidor.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-noche">Registro y emparejamiento</h1>
      <p className="mt-2 text-tinta/80">
        Progenitor A: invita al otro progenitor a tu familia en ALBA. Los hijos se agregan
        dentro del vínculo, no antes.
      </p>
      <Link href="/perfil" className="mt-3 inline-block text-sm font-medium text-coral underline">
        Editar mi perfil y el de mis hijos →
      </Link>

      <section className="mt-8 rounded-lg border border-tinta/10 bg-white/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-noche">Invitar al otro progenitor</h2>
        {pendingInvitations.length > 0 ? (
          pendingInvitations.map((inv) => (
            <p key={inv.id} className="mt-3 break-all rounded-md bg-cielo/30 px-3 py-2 font-mono text-xs text-noche">
              Link de invitación: /invitacion/{inv.token}
            </p>
          ))
        ) : (
          <form action={createInvitationAction} className="mt-3">
            <button type="submit" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-[#4A1B0C]">
              Generar link de invitación
            </button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-tinta/10 bg-white/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-noche">Agregar hijo/a</h2>
        <form action={createChildAction} className="mt-3 flex flex-col gap-3">
          <label className="text-sm font-medium text-tinta">
            Nombre completo
            <input
              name="childFullName"
              autoComplete="off"
              required
              minLength={2}
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
              className="mt-1 w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta"
            />
          </label>
          <button type="submit" className="mt-1 self-start rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-[#412402]">
            Agregar hijo/a
          </button>
        </form>
      </section>

      {children.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {children.map((child) => (
            <li key={child.id} className="rounded-lg border border-tinta/10 bg-white/50 p-4">
              <p className="font-medium text-noche">{child.fullName}</p>
              <p className="text-sm text-tinta/70">Nacimiento: {child.birthDate}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
