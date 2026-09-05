import Link from "next/link";
import type { ComplianceIssueType } from "@alba/core";

const complianceIssueLabels: Record<ComplianceIssueType, string> = {
  missed_checkin: "Check-in no confirmado",
  late_checkin: "Check-in fuera de tolerancia",
  missed_checkout: "Check-out no confirmado",
};

const domainModules: Array<{ name: string; description: string }> = [
  { name: "domain/entities", description: "Progenitores, hijos, gastos, eventos de custodia y convenio." },
  { name: "validation/schemas", description: "Esquemas zod para gastos y eventos de check-in/check-out." },
  {
    name: "compliance/complianceEngine",
    description: `Motor determinístico de incumplimientos, sin IA — detecta: ${Object.values(complianceIssueLabels).join(", ")}.`,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-20 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          ALBA · Etapa 2
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Monorepo inicializado
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          <code className="font-mono text-sm">apps/web</code> ya resuelve tipos desde{" "}
          <code className="font-mono text-sm">@alba/core</code>. El módulo de registro y
          emparejamiento ya tiene un flujo de punta a punta corriendo contra un repositorio
          mock — pendiente conectar el proyecto real de Supabase
          (<code className="font-mono text-sm">apps/web/.env.local</code>).
        </p>

        <Link
          href="/registro"
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Probar registro y emparejamiento →
        </Link>

        <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {domainModules.map((mod) => (
            <li key={mod.name} className="p-4">
              <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">@alba/core/{mod.name}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{mod.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
