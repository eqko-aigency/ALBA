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
    return (
      <StatusPage
        title="Invitación aceptada"
        message={
          children.length > 0
            ? `Ya quedaste vinculado. Hijos en la familia: ${children.map((c) => c.fullName).join(", ")}.`
            : "Ya quedaste vinculado con el otro progenitor."
        }
      />
    );
  }

  if (invitation.status === "expired" || new Date(invitation.expiresAt) < new Date()) {
    return <StatusPage title="Invitación expirada" message="Pide al otro progenitor que genere un link nuevo." />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center bg-bruma">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-ambar bg-ambar/20 px-4 py-2 text-sm text-noche">
          Modo de prueba local — aceptando como Progenitor B.
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-noche">Te invitaron a coparentar</h1>
      <p className="mt-2 text-tinta/80">
        El otro progenitor te está invitando a vincular tu familia en ALBA.
      </p>
      <form action={acceptInvitationAction} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-[#4A1B0C]">
          Aceptar invitación
        </button>
      </form>
    </div>
  );
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center bg-bruma">
      <h1 className="text-2xl font-semibold tracking-tight text-noche">{title}</h1>
      <p className="mt-2 text-tinta/80">{message}</p>
    </div>
  );
}
