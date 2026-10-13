import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import {
  BovedaIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  GastosIcon,
  NotesIcon,
  UsageModeIcon,
  UserIcon,
} from "@/components/icons";
import type { ComponentType } from "react";

/** Página de ventas pública (no autenticada) — reemplaza el splash mínimo
 * anterior. Sigue siendo un Server Component puro: ningún bloque de abajo
 * necesita estado de cliente (los FAQ usan <details>, igual que el resto
 * de la app — ver "Cambiar título del hilo" en chat/[threadId]/page.tsx). */
export const metadata: Metadata = {
  title: "ALBA — Coparentalidad sin que el conflicto se interponga",
  description:
    "Chat con tono cuidado, calendario de custodia, gastos claros y documentos con respaldo — todo en un solo lugar, con evidencia lista si alguna vez la necesitas.",
};

type Feature = {
  title: string;
  description: string;
  accent: string;
  Icon: ComponentType<{ className?: string }>;
};

const PAIN_POINTS: { title: string; description: string }[] = [
  {
    title: "Los mensajes suben de tono",
    description: "Una conversación sobre horarios termina siendo otra discusión más.",
  },
  {
    title: "Nadie se acuerda quién dijo qué",
    description: "Acuerdos de palabra, capturas de pantalla perdidas, versiones distintas de la misma conversación.",
  },
  {
    title: "Los gastos compartidos generan desconfianza",
    description: "¿Quién pagó qué, cuándo, y cuánto falta? Sin un registro claro, todo se vuelve un reclamo.",
  },
  {
    title: "Si hace falta mostrar algo, no hay con qué",
    description: "Ante un mediador o un juez, perseguir pantallazos no es lo mismo que tener un registro con respaldo.",
  },
];

const FEATURES: Feature[] = [
  {
    title: "Chat con tono cuidado",
    description:
      "Antes de enviar, ALBA revisa el tono del mensaje. Si detecta tensión u hostilidad, te avisa y te sugiere una versión más neutral — tú decides si la usas.",
    accent: "bg-salmon",
    Icon: ChatIcon,
  },
  {
    title: "Mensajes con respaldo",
    description:
      "Cada mensaje queda con su propia huella digital (SHA-256). Puedes sellar una conversación completa con una raíz Merkle, para que sirva como evidencia si alguna vez la necesitas.",
    accent: "bg-orange",
    Icon: ClockIcon,
  },
  {
    title: "Calendario de custodia y visitas",
    description:
      "Configura el convenio con slots recurrentes, confirma check-in y check-out de cada visita, y define los lugares de encuentro habituales.",
    accent: "bg-sky",
    Icon: CalendarIcon,
  },
  {
    title: "Gastos y pensión alimenticia",
    description:
      "Registra y aprueba gastos compartidos con balance 50/50 siempre a la vista, además del seguimiento de la pensión mensual fija y su historial.",
    accent: "bg-dawn",
    Icon: GastosIcon,
  },
  {
    title: "Bóveda de documentos",
    description:
      "Convenios, actas y evidencia protegidos con hash SHA-256 y anclaje por Merkle Tree, para verificar que nadie los alteró después de subirlos.",
    accent: "bg-purple",
    Icon: BovedaIcon,
  },
  {
    title: "Acuerdos verbales",
    description:
      "Deja constancia de lo que acordaron por teléfono o en persona. El otro progenitor confirma que lo recuerda igual, y queda registrado.",
    accent: "bg-sea",
    Icon: NotesIcon,
  },
];

const STEPS: { title: string; description: string; Icon: ComponentType<{ className?: string }> }[] = [
  {
    title: "Crea tu cuenta",
    description: "En minutos. Agrega a tus hijos y cuenta tu situación — no necesitas nada más para empezar.",
    Icon: UserIcon,
  },
  {
    title: "Decide cómo la vas a usar",
    description:
      "Invita al otro progenitor para coordinarse juntos, o usa ALBA tú solo/a por ahora y suma a la otra persona después.",
    Icon: UsageModeIcon,
  },
  {
    title: "Organicen todo en un solo lugar",
    description: "Chat, calendario, gastos y documentos — con evidencia lista, por si alguna vez la necesitan.",
    Icon: CalendarIcon,
  },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: "¿Necesito que el otro progenitor también use ALBA?",
    answer:
      "No. Al crear tu cuenta puedes elegir usarla tú solo/a para llevar tu propio registro, e invitar al otro progenitor cuando quieras. Si ambos se suman, pueden coordinarse juntos desde el primer día.",
  },
  {
    question: "¿Esto sirve como prueba legal?",
    answer:
      "ALBA te da un registro con respaldo técnico: hash SHA-256 por mensaje y documento, y sellado con raíz Merkle para que se note si algo fue alterado después. No sustituye la asesoría de un abogado, pero te da algo mucho más sólido que una captura de pantalla.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer: "Puedes crear tu cuenta y empezar a usar ALBA hoy mismo, sin costo.",
  },
  {
    question: "¿Qué pasa si seguimos discutiendo mucho?",
    answer:
      "Para eso está el aviso de tono antes de enviar un mensaje, y el registro de acuerdos verbales cuando algo se habla fuera del chat. ALBA no resuelve el conflicto por ustedes, pero evita que escale y deja constancia de lo que se acordó.",
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

        {/* Pain points */}
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            ¿Te suena familiar?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PAIN_POINTS.map((point) => (
              <div key={point.title} className="rounded-2xl border border-subtle bg-card p-5 shadow-ambient">
                <p className="text-sm font-semibold text-ink">{point.title}</p>
                <p className="mt-1.5 text-sm text-ink-soft">{point.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo ALBA ayuda */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Cómo ALBA ayuda</h2>
            <p className="mt-2 text-ink-soft">
              No es solo un calendario compartido — es un espacio pensado para bajar la tensión y dejar
              constancia de lo que importa.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, ...feature }) => (
              <div key={feature.title} className="rounded-3xl border border-subtle bg-card p-6 text-left shadow-ambient">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-ink ${feature.accent}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <p className="mt-3 text-base font-semibold text-ink">{feature.title}</p>
                <p className="mt-2 text-sm text-ink-soft">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">Cómo funciona</h2>
          <div className="mt-8 flex flex-col gap-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-subtle bg-card p-5 shadow-ambient">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange text-sm font-bold text-ink">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <step.Icon className="h-4 w-4 text-ink-soft" />
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Confianza y evidencia */}
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-sea to-sky p-7 shadow-elevated sm:p-10">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-ink">
              <BovedaIcon className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Lo que se dice, queda registrado
            </h2>
            <p className="mt-3 text-sm text-ink/80 sm:text-base">
              Cada mensaje que envías genera su propia huella digital (un hash SHA-256) y puedes sellar una
              conversación completa calculando una raíz Merkle sobre todos sus mensajes — la misma lógica que
              usan los sistemas de verificación a prueba de alteraciones, para que se note si algo cambió después
              de que se dijo.
            </p>
            <p className="mt-3 text-sm text-ink/80 sm:text-base">
              Los documentos que subes a la Bóveda funcionan igual: hash y anclaje por Merkle Tree, para que
              tengas certeza de que el convenio o el comprobante que guardaste es el mismo que subiste el primer
              día.
            </p>
            <p className="mt-3 text-xs text-ink/70">
              Esto no sustituye la asesoría de un abogado, pero te da un registro mucho más sólido que una
              captura de pantalla si alguna vez necesitas mostrar algo a un mediador o un juez.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-2xl px-6 pb-16">
          <h2 className="text-center text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Preguntas frecuentes
          </h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="rounded-2xl border border-subtle bg-card p-4 shadow-ambient [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink">
                  {item.question}
                  <span className="flex-shrink-0 text-ink-faint" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-ink-soft">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

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
