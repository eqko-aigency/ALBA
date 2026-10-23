import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { createChildAction } from "./actions";
import { CopyInvitationLink } from "@/components/CopyInvitationLink";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

/** Código corto legible derivado del token — estilo W-03 (ej. ALBA-9842-XN23). */
function formatInvitationCode(token: string): string {
  const compact = token.replace(/-/g, "").toUpperCase();
  return `ALBA-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

export default async function RegistroPage() {
  const { pairing, parentId } = await getRequestContext();

  await pairing.getOrCreateMyFamily(parentId);
  const [pendingInvitations, children, familyMembers] = await Promise.all([
    pairing.listPendingInvitations(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  const otherParent = familyMembers.find((m) => m.id !== parentId) ?? null;

  // listPendingInvitations devuelve todo lo que sigue en status "pending" en
  // la base, pero nada transiciona ese status a "expired" cuando pasa
  // expiresAt — sin este filtro, un código vencido se mostraría para siempre
  // y nunca se ofrecería generar uno nuevo.
  let activeInvitations = pendingInvitations.filter((inv) => new Date(inv.expiresAt) > new Date());
  const hasExpiredInvitation = pendingInvitations.length > 0 && activeInvitations.length === 0;

  // Antes había que tocar "Generar código de invitación" ANTES de que
  // apareciera algo para compartir — un paso extra escondido que se sentía
  // como "no pasa nada". Ahora, si no hay invitación activa, se genera sola
  // al cargar la página — lo único que el progenitor ve es el link/código
  // listo para compartir, de una. Pero si ya está vinculado (otherParent),
  // no tiene sentido seguir ofreciendo un código nuevo — la clienta reportó
  // que nada en la app confirmaba que el enlace ya había funcionado.
  if (activeInvitations.length === 0 && !otherParent) {
    const created = await pairing.createInvitation(parentId);
    activeInvitations = [created];
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-8 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — sin Supabase conectado. Los datos viven en memoria y se
          pierden al reiniciar el servidor.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Registro y emparejamiento</h1>
      <p className="mt-2 text-ink-soft">
        Progenitor A: invita al otro progenitor a tu familia en ALBA. Los hijos se agregan
        dentro del vínculo, no antes.
      </p>
      <Link
        href="/perfil"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border-2 border-subtle bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        Editar mi perfil y el de mis hijos
        <span aria-hidden="true">→</span>
      </Link>

      <section className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Invitar al otro progenitor</h2>
        {otherParent ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">
            ✓ Vinculado con {otherParent.fullName}
          </p>
        ) : (
          <>
            {hasExpiredInvitation && (
              <p className="mt-3 text-sm text-ink-soft">Tu código anterior venció — aquí tienes uno nuevo.</p>
            )}
            {activeInvitations.map((inv) => (
              <div key={inv.id} className="mt-3 rounded-md bg-sea px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-ink-soft">Código de vinculación</p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-ink">
                  {formatInvitationCode(inv.token)}
                </p>
                <p className="mt-3 text-xs text-ink-faint">O comparte el enlace protegido:</p>
                <CopyInvitationLink url={`${siteUrl}/invitacion/${inv.token}`} />
              </div>
            ))}
          </>
        )}
      </section>

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
              className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
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
                className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
              />
            </div>
          </label>
          <button type="submit" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
            Agregar hijo/a
          </button>
        </form>
      </section>

      {children.length > 0 && (
        <ul className="mt-6 flex flex-col gap-3">
          {children.map((child) => (
            <li key={child.id} className="rounded-lg border border-subtle bg-card p-4 shadow-ambient">
              <p className="font-medium text-ink">{child.fullName}</p>
              <p className="text-sm text-ink-soft">Nacimiento: {child.birthDate}</p>
            </li>
          ))}
        </ul>
      )}

      <AppNav />
    </div>
  );
}
