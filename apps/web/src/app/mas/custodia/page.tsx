import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { AppHeader } from "@/components/AppHeader";
import { CalendarioTab } from "./CalendarioTab";
import { IntercambiosTab } from "./IntercambiosTab";
import { RecordatoriosTab } from "./RecordatoriosTab";

type CustodiaTab = "calendario" | "intercambios" | "recordatorios";

function tabHref(tab: CustodiaTab, as?: string): string {
  const params = new URLSearchParams({ tab });
  if (as === "b") params.set("as", "b");
  return `/mas/custodia?${params.toString()}`;
}

const TABS: { key: CustodiaTab; label: string }[] = [
  { key: "calendario", label: "Calendario" },
  { key: "intercambios", label: "Intercambios" },
  { key: "recordatorios", label: "Recordatorios" },
];

export default async function CustodiaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; tab?: string }>;
}) {
  const { as, tab: rawTab } = await searchParams;
  const tab: CustodiaTab = rawTab === "intercambios" || rawTab === "recordatorios" ? rawTab : "calendario";
  const { pairing, custody, documents, parentId } = await getRequestContext(as);

  const [profile, kids, familyMembers, agreement, docs] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.getMyChildren(parentId),
    pairing.listFamilyMembers(parentId),
    custody.getMyAgreement(parentId),
    documents.listDocuments(parentId),
  ]);

  const analyzableDocuments = docs.filter((d) => d.mimeType === "application/pdf" || (d.mimeType?.startsWith("image/") ?? false));
  const asQuery = as === "b" ? "?as=b" : "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      {isDemoMode && (
        <p className="mb-6 mt-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/mas/custodia" : "/mas/custodia?as=b"} className="underline">
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

      <h1 className="text-xl font-extrabold text-ink">Custodia</h1>

      <nav className="mt-4 flex gap-1 rounded-2xl bg-sand p-1">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={tabHref(key, as)}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold transition-colors ${
              tab === key ? "bg-ink text-white" : "text-ink-soft"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "calendario" && (
          <CalendarioTab
            as={as}
            parentId={parentId}
            agreement={agreement}
            kids={kids}
            familyMembers={familyMembers}
            analyzableDocuments={analyzableDocuments}
          />
        )}
        {tab === "intercambios" && (
          <IntercambiosTab as={as} parentId={parentId} agreement={agreement} kids={kids} familyMembers={familyMembers} custody={custody} />
        )}
        {tab === "recordatorios" && (
          <RecordatoriosTab
            as={as}
            parentId={parentId}
            kids={kids}
            analyzableDocuments={analyzableDocuments}
            custody={custody}
          />
        )}
      </div>

      <AppNav active="Más" />
    </div>
  );
}
