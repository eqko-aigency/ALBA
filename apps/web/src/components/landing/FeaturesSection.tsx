import type { ComponentType } from "react";
import { BovedaIcon, ChatIcon, ClockIcon, CalendarIcon, GastosIcon, NotesIcon } from "@/components/icons";

type Feature = {
  title: string;
  description: string;
  accent: string;
  Icon: ComponentType<{ className?: string }>;
};

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

export function FeaturesSection() {
  return (
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
  );
}
