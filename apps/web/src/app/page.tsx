import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

const FEATURES: { title: string; description: string; gradient: string }[] = [
  {
    title: "Chat con tono cuidado",
    description: "Habla con el otro progenitor sin que el tono escale — se revisa antes de enviar.",
    gradient: "from-salmon to-orange",
  },
  {
    title: "Calendario compartido",
    description: "Confirma check-ins y check-outs, sin ambigüedad sobre quién tiene a los hijos.",
    gradient: "from-sky to-sea",
  },
  {
    title: "Gastos transparentes",
    description: "Registra, aprueba y lleva el balance de los gastos compartidos.",
    gradient: "from-dawn to-salmon",
  },
  {
    title: "Documentos seguros",
    description: "Acuerdos y evidencia protegidos, con verificación de que nadie los alteró.",
    gradient: "from-purple to-sky",
  },
];

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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center px-6 py-20 text-center">
        <Wordmark className="text-6xl" />
        <p className="mt-4 max-w-md text-lg text-ink-soft">
          Coparentalidad sin fricción — un solo lugar para hablar, organizar y acordar, sin que el
          conflicto se interponga.
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

        <div className="mt-16 grid w-full gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`rounded-3xl bg-gradient-to-br p-6 text-left shadow-ambient ${feature.gradient}`}
            >
              <p className="text-base font-semibold text-ink">{feature.title}</p>
              <p className="mt-2 text-sm text-ink/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
