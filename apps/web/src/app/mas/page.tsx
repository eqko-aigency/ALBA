import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { BovedaIcon, GastosIcon, UserIcon } from "@/components/icons";

function FeatureCard({
  href,
  label,
  iconBgClass,
  icon,
  disabled,
}: {
  href?: string;
  label: string;
  iconBgClass: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBgClass}`}>{icon}</span>
      <span className="text-center text-sm font-bold leading-tight text-ink">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[18px] border border-subtle bg-card p-[18px_10px] opacity-50 shadow-ambient">
        {inner}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Próximamente</span>
      </div>
    );
  }
  return (
    <Link
      href={href!}
      className="flex flex-col items-center gap-2.5 rounded-[18px] border border-subtle bg-card p-[18px_10px] shadow-ambient"
    >
      {inner}
    </Link>
  );
}

export default async function MasPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const profile = await pairing.getProfile(parentId);
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas" : "/mas?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <AppHeader avatarKey={profile?.avatarKey ?? null} unseenNotifications={0} as={as} />

      <h1 className="text-xl font-extrabold text-ink">Más funciones</h1>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <FeatureCard
          href={`/mas/nucleo${asQuery}`}
          label="Tu Núcleo"
          iconBgClass="bg-dawn"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/gastos${asQuery}`}
          label="Gastos"
          iconBgClass="bg-orange"
          icon={<GastosIcon className="h-[21px] w-[21px] text-[#3a332e]" />}
        />
        <FeatureCard
          href={`/perfil${asQuery}`}
          label="Perfil"
          iconBgClass="bg-sky"
          icon={<UserIcon className="h-[21px] w-[21px] text-[#3a332e]" />}
        />
        <FeatureCard
          href={`/boveda${asQuery}`}
          label="Info y documentos"
          iconBgClass="bg-salmon"
          icon={<BovedaIcon className="h-[21px] w-[21px] text-[#3a332e]" />}
        />
        <FeatureCard
          label="Medicación"
          iconBgClass="bg-success"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="4" stroke="#fff" strokeWidth="1.8" />
              <path d="M12 8v8M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/mas/custodia${asQuery}`}
          label="Custodia"
          iconBgClass="bg-purple"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 7l-3 3 3 3M17 7l3 3-3 3M4 10h16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          href={`/boveda/acuerdos${asQuery}`}
          label="Acuerdos"
          iconBgClass="bg-sea"
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 4.5h7.5L18 8v10.5A1.5 1.5 0 0116.5 20h-9A1.5 1.5 0 016 18.5v-12A1.5 1.5 0 017 4.5z" stroke="#3a332e" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M9 13.3l1.8 1.8L15 11" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <FeatureCard
          label="Listas"
          iconBgClass="bg-sky"
          disabled
          icon={
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="4" stroke="#3a332e" strokeWidth="1.8" />
              <path d="M8.5 12l2.2 2.2L16 9" stroke="#3a332e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      <AppNav active="Más" />
    </div>
  );
}
