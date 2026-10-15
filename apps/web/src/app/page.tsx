import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FaqSection } from "@/components/landing/FaqSection";

/** Página de ventas pública (no autenticada) — reemplaza el splash mínimo
 * anterior. Sigue siendo un Server Component puro: ningún bloque de abajo
 * necesita estado de cliente (los FAQ usan <details>, igual que el resto
 * de la app — ver "Cambiar título del hilo" en chat/[threadId]/page.tsx). */
export const metadata: Metadata = {
  title: "ALBA — Coparentalidad sin que el conflicto se interponga",
  description:
    "Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un solo lugar, con evidencia lista si alguna vez la necesitas.",
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sand">
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-salmon), var(--alba-orange))" }}
      />
      <div
        className="pointer-events-none absolute -right-28 top-6 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-sky), var(--alba-sea))" }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Wordmark className="text-3xl" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft">
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
            >
              Crear cuenta
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-16 pt-6 text-center sm:pt-12">
          <span className="rounded-full border border-subtle bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft shadow-ambient">
            Para familias que coparentan
          </span>
          <Wordmark className="mt-6 text-7xl sm:text-8xl" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Coparentalidad sin que el conflicto se interponga
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-soft sm:text-lg">
            Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un
            solo lugar, para que lo que importa sea tus hijos, no la discusión.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/ingresar"
              className="rounded-full border-2 border-subtle bg-card px-6 py-3 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/crear-cuenta"
              className="rounded-full bg-orange px-6 py-3 text-sm font-semibold text-ink shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
            >
              Crear cuenta →
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Gratis para crear tu cuenta. Puedes usarla aunque el otro progenitor no se una todavía.
          </p>
        </section>

        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <FaqSection />

        {/* CTA final */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-dawn to-orange p-8 text-center shadow-elevated sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Empieza hoy</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink/80 sm:text-base">
              Crea tu cuenta gratis, agrega a tus hijos y organiza todo en un solo lugar — a tu ritmo, aunque el
              otro progenitor todavía no se una.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/crear-cuenta"
                className="rounded-full bg-card px-6 py-3 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                Crear cuenta →
              </Link>
              <Link
                href="/ingresar"
                className="rounded-full border-2 border-ink/10 px-6 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-0.5"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mx-auto max-w-5xl border-t border-subtle px-6 py-10 text-center">
          <Wordmark className="text-2xl" />
          <p className="mt-2 text-sm text-ink-soft">Coparentalidad sin fricción.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-ink-soft">
            <Link href="/ingresar" className="underline">
              Iniciar sesión
            </Link>
            <Link href="/crear-cuenta" className="underline">
              Crear cuenta
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-faint">© {new Date().getFullYear()} ALBA</p>
        </footer>
      </div>
    </div>
  );
}
