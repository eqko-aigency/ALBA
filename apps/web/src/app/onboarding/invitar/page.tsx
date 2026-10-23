import { Wordmark } from "@/components/Wordmark";
import { getRequestContext } from "@/lib/repository";
import { CopyInvitationLink } from "@/components/CopyInvitationLink";
import { skipInviteStepAction } from "./actions";
import { sendInvitationEmailAction } from "./emailActions";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/** Código corto legible derivado del token — estilo W-03 (ej. ALBA-9842-XN23). */
function formatInvitationCode(token: string): string {
  const compact = token.replace(/-/g, "").toUpperCase();
  return `ALBA-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

export default async function OnboardingInvitarPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; emailError?: string; emailSent?: string }>;
}) {
  const { as, emailError, emailSent } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);

  await pairing.getOrCreateMyFamily(parentId);
  let activeInvitations = (await pairing.listPendingInvitations(parentId)).filter(
    (inv) => new Date(inv.expiresAt) > new Date()
  );
  if (activeInvitations.length === 0) {
    const created = await pairing.createInvitation(parentId);
    activeInvitations = [created];
  }
  const invitation = activeInvitations[0]!;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Invita al otro progenitor</h1>
      <p className="mt-2 text-ink-soft">Mándale este link, o su correo, para que se vincule contigo.</p>

      <div className="mt-8 w-full rounded-md bg-sea px-4 py-3 text-left">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Código de vinculación</p>
        <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-ink">
          {formatInvitationCode(invitation.token)}
        </p>
        <p className="mt-3 text-xs text-ink-faint">O comparte el enlace protegido:</p>
        <CopyInvitationLink url={`${siteUrl}/invitacion/${invitation.token}`} />
      </div>

      <form action={sendInvitationEmailAction} className="mt-6 flex w-full flex-col gap-2 text-left">
        <input type="hidden" name="as" value={as ?? ""} />
        <label className="text-sm font-medium text-ink">
          O mándaselo por correo
          <input
            name="email"
            type="email"
            autoComplete="off"
            required
            placeholder="correo@ejemplo.com"
            className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
          />
        </label>
        {emailError && <p className="text-sm text-danger">{emailError}</p>}
        {emailSent && <p className="text-sm font-medium text-success">✓ Correo enviado</p>}
        <button type="submit" className="mt-1 rounded-full bg-orange px-4 py-2.5 text-sm font-semibold text-ink">
          Mandar invitación por correo
        </button>
      </form>

      <form action={skipInviteStepAction} className="mt-6">
        <input type="hidden" name="as" value={as ?? ""} />
        <button type="submit" className="text-sm font-medium text-ink-soft underline">
          Hacerlo después
        </button>
      </form>
    </div>
  );
}
