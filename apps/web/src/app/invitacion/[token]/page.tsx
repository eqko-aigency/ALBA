import Link from "next/link";
import { getPublicPairingRepository, getRequestContext, isSupabaseConfigured } from "@/lib/repository";
import { createSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isDemoMode } from "@/lib/demoSession";
import { acceptInvitationAction } from "./actions";

export default async function InvitacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const pairing = await getPublicPairingRepository();
  const invitation = await pairing.getInvitationByToken(token);

  if (!invitation) {
    return <StatusPage title="Invitación no encontrada" message="Revisa que el link esté completo." />;
  }

  if (invitation.status === "accepted") {
    const { pairing: authedPairing, parentId } = await getRequestContext("b");
    const children = await authedPairing.getMyChildren(parentId);
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
    return <StatusPage title="Invitación expirada" message="Pide al otro progenitor que genere un código nuevo." />;
  }

  // Antes, un invitado sin sesión (ej. un progenitor que todavía no se
  // registra) tocaba "Aceptar invitación" y el server action reventaba con
  // "No hay sesión activa" — sin ninguna salida clara. Ahora detectamos eso
  // acá y mandamos a crear cuenta / iniciar sesión antes de intentar aceptar.
  let hasSession = true;
  if (isSupabaseConfigured) {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    hasSession = Boolean(user);
  }

  if (!hasSession) {
    const nextParam = encodeURIComponent(`/invitacion/${token}`);
    return (
      <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center bg-sand">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Te invitaron a coparentar</h1>
        <p className="mt-2 text-ink-soft">
          Primero necesitas una cuenta en ALBA para vincularte con el otro progenitor.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/crear-cuenta"
            className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-elevated"
          >
            Crear mi cuenta
          </Link>
          <Link
            href={`/ingresar?next=${nextParam}`}
            className="rounded-full border border-subtle bg-card px-5 py-2.5 text-sm font-medium text-ink"
          >
            Ya tengo cuenta — iniciar sesión
          </Link>
        </div>
        <p className="mt-6 text-xs text-ink-faint">
          Si creas una cuenta nueva, confirma tu correo y luego vuelve a abrir este mismo link para aceptar la invitación.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center bg-sand">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — aceptando como Progenitor B.
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Te invitaron a coparentar</h1>
      <p className="mt-2 text-ink-soft">
        El otro progenitor te está invitando a vincular tu familia en ALBA.
      </p>
      {error === "ya_tiene_familia" ? (
        <p className="mt-8 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink">
          Ya tienes tu propia familia en ALBA (se crea automáticamente al registrarte), así que no puedes aceptar
          esta invitación todavía — primero hay que borrar esa familia desde el equipo de soporte. Contáctanos
          para resolverlo.
        </p>
      ) : (
        <form action={acceptInvitationAction} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-elevated">
            Aceptar invitación
          </button>
        </form>
      )}
    </div>
  );
}

function StatusPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto min-h-screen max-w-md px-6 py-16 text-center bg-sand">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-ink-soft">{message}</p>
    </div>
  );
}
