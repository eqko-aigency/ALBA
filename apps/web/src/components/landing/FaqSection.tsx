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

export function FaqSection() {
  return (
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
  );
}
