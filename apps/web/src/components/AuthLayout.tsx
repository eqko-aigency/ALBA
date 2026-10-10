/** Fondo decorativo compartido por /ingresar y /crear-cuenta — manchas de
 * gradiente difuminadas con la paleta oficial de marca (nunca colores fuera
 * de ella), inspiradas en el estilo "dashboard suave" que aprobó la clienta:
 * formas orgánicas tipo ola, en vez de bloques planos. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-sand">
      <div
        className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-salmon), var(--alba-orange))" }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-24 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-sky), var(--alba-sea))" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/4 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "linear-gradient(135deg, var(--alba-dawn), var(--alba-purple))" }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        {children}
      </div>
    </div>
  );
}
