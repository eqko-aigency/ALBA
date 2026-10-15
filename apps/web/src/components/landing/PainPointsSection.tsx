type PainPoint = { title: string; description: string };

const PAIN_POINTS: PainPoint[] = [
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

export function PainPointsSection() {
  return (
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
  );
}
