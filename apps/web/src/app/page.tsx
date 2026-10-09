import Link from "next/link";
import type { ComplianceIssueType } from "@alba/core";
import { Wordmark } from "@/components/Wordmark";

const complianceIssueLabels: Record<ComplianceIssueType, string> = {
  missed_checkin: "Check-in no confirmado",
  late_checkin: "Check-in fuera de tolerancia",
  missed_checkout: "Check-out no confirmado",
};

const domainModules: Array<{ name: string; description: string }> = [
  { name: "domain/entities", description: "Familias, progenitores, hijos, gastos, eventos de custodia y convenio." },
  { name: "validation/schemas", description: "Esquemas zod para gastos y eventos de check-in/check-out." },
  {
    name: "compliance/complianceEngine",
    description: `Motor determinístico de incumplimientos, sin IA — detecta: ${Object.values(complianceIssueLabels).join(", ")}.`,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-sand px-6 py-20">
      <main className="w-full max-w-2xl">
        <Wordmark className="text-5xl" />
        <p className="mt-4 text-sm font-medium uppercase tracking-wide text-purple">ALBA · Etapa 2</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Monorepo inicializado</h1>
        <p className="mt-3 text-ink-soft">
          <code className="font-mono text-sm">apps/web</code> ya resuelve tipos desde{" "}
          <code className="font-mono text-sm">@alba/core</code>. Registro/emparejamiento por familia y
          perfiles ya tienen un flujo de punta a punta corriendo contra un repositorio mock —
          pendiente conectar el proyecto real de Supabase
          (<code className="font-mono text-sm">apps/web/.env.local</code>).
        </p>

        <Link
          href="/registro"
          className="mt-6 inline-block rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-elevated"
        >
          Probar registro y emparejamiento →
        </Link>

        <ul className="mt-8 divide-y divide-sand rounded-lg border border-subtle bg-card shadow-ambient">
          {domainModules.map((mod) => (
            <li key={mod.name} className="p-4">
              <p className="font-mono text-sm text-ink">@alba/core/{mod.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{mod.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
