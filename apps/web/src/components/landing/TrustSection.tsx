import { BovedaIcon } from "@/components/icons";

export function TrustSection() {
  return (
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
  );
}
