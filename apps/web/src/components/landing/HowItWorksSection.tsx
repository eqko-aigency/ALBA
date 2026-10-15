import type { ComponentType } from "react";
import { CalendarIcon, UsageModeIcon, UserIcon } from "@/components/icons";

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

export function HowItWorksSection() {
  return (
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
  );
}
