import { pairingRepository } from "@/lib/repository";
import { DEMO_PARENT_B_ID, isDemoMode } from "@/lib/demoSession";
import { acceptInvitationAction } from "./actions";

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await pairingRepository.getInvitationByToken(token);

  if (!invitation) {
    return <StatusPage title="Invitación no encontrada" message="Revisa que el link esté completo." />;
  }

  if (invitation.status === "accepted") {
    const children = await pairingRepository.getMyChildren(DEMO_PARENT_B_ID);
    const child = children.find((c) => c.id === invitation.childId);
    return (
      <StatusPage
        title="Invitación aceptada"
        message={child ? `Ya quedaste vinculado a ${child.fullName}.` : "Ya quedaste vinculado."}
      />
    );
  }

  if (invitation.status === "expired" || new Date(invitation.expiresAt) < new Date()) {
    return <StatusPage title="Invitación expirada" message="Pide al otro progenitor que genere un link nuevo." />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center font-sans">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Modo de prueba local — aceptando como Progenitor B.
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">Te invitaron a coparentar</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        El otro progenitor te está invitando a compartir el seguimiento de su hijo/a en ALBA.
      </p>
      <form action={acceptInvitationAction} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Aceptar invitación
        </button>
      </form>
    </div>
  );
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center font-sans">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{message}</p>
    </div>
  );
}
