import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { AVATAR_SRC } from "@/lib/avatars";
import type { AvatarKey } from "@alba/core";

function PersonRow({ name, avatarKey }: { name: string; avatarKey: AvatarKey | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-subtle bg-card px-3.5 py-2.5 shadow-ambient">
      {avatarKey ? (
        <img
          src={AVATAR_SRC[avatarKey]}
          alt={name}
          className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
          style={{ objectPosition: "center 15%" }}
        />
      ) : (
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-dawn text-sm font-bold text-ink">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="text-[15px] font-semibold text-ink">{name}</span>
    </div>
  );
}

export default async function NucleoPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const [profile, children, familyMembers] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
  ]);
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas/nucleo" : "/mas/nucleo?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <Link href={`/mas${asQuery}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Más
      </Link>

      <h1 className="text-xl font-extrabold text-ink">Tu Núcleo</h1>
      <p className="mt-1 text-sm text-ink-soft">Quiénes forman parte de la vida de tu familia.</p>

      <div className="mt-5 overflow-hidden rounded-[20px] border border-subtle shadow-ambient">
        <img
          src="/avatars/retrato-familiar.png"
          alt="Retrato ilustrado de la familia"
          width={1536}
          height={1024}
          className="w-full"
        />
      </div>

      <div className="mt-6">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los hijos</p>
        <div className="flex flex-col gap-2">
          {children.length === 0 ? (
            <p className="rounded-2xl border border-subtle bg-card px-3.5 py-3 text-sm text-ink-soft">
              Todavía no agregaste a ningún hijo.
            </p>
          ) : (
            children.map((child) => <PersonRow key={child.id} name={child.fullName} avatarKey={child.avatarKey} />)
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los progenitores</p>
        <div className="flex flex-col gap-2">
          <PersonRow name="Tú" avatarKey={profile?.avatarKey ?? null} />
          {familyMembers
            .filter((m) => m.id !== parentId)
            .map((m) => (
              <PersonRow key={m.id} name={m.fullName} avatarKey={m.avatarKey} />
            ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-ink">Los familiares</p>
        <div className="rounded-2xl border border-dashed border-subtle bg-card px-3.5 py-4 text-center">
          <p className="text-sm font-semibold text-ink">Próximamente</p>
          <p className="mt-1 text-xs text-ink-soft">
            Vas a poder invitar a abuelos, niñeras y otras personas de confianza.
          </p>
        </div>
      </div>

      <AppNav active="Más" />
    </div>
  );
}
