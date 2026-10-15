import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { PainPointsSection } from "@/components/landing/PainPointsSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { WaitlistForm } from "../WaitlistForm";

export const metadata: Metadata = {
  title: "ALBA — Lista de espera",
  description:
    "Apúntate para ser de los primeros en usar ALBA, la app de coparentalidad sin que el conflicto se interponga.",
};

export default function ListaEspera() {
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
        {/* Header — sin links de cuenta, a propósito: esta página es solo para apuntarse a la lista de espera */}
        <header className="mx-auto flex max-w-5xl items-center justify-center px-6 py-5">
          <Link href="/">
            <Wordmark className="text-3xl" />
          </Link>
        </header>

        {/* Hero — mismo mensaje que el landing normal, pero el botón lleva al formulario de abajo en vez de a Crear cuenta/Iniciar sesión */}
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
          <a
            href="#waitlist"
            className="mt-8 rounded-full bg-orange px-6 py-3 text-sm font-semibold text-ink shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-orange-deep"
          >
            Únete a la lista de espera ↓
          </a>
        </section>

        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
        <FaqSection />

        {/* Lista de espera — reemplaza el "CTA final" del landing normal */}
        <section id="waitlist" className="mx-auto max-w-2xl px-6 pb-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Sé de los primeros en usar ALBA
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-ink-soft">
            Déjanos tu correo y te avisamos en cuanto tengamos cupo disponible.
          </p>
          <WaitlistForm />
        </section>

        {/* Footer — sin links de cuenta, a propósito */}
        <footer className="mx-auto max-w-5xl border-t border-subtle px-6 py-10 text-center">
          <Wordmark className="text-2xl" />
          <p className="mt-2 text-sm text-ink-soft">Coparentalidad sin fricción.</p>
          <p className="mt-4 text-xs text-ink-faint">© {new Date().getFullYear()} ALBA</p>
        </footer>
      </div>
    </div>
  );
}
