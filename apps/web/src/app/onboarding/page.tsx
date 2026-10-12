import { Wordmark } from "@/components/Wordmark";
import { setUsageModeAction } from "./actions";

/**
 * Primera pantalla tras confirmar la cuenta (W-xx) — pedido explícito de la
 * clienta: "en el menú de inicio tiene que empezar haciéndote algunas
 * preguntas... si la van a usar ambos o solo tú". dashboard/page.tsx manda
 * acá a cualquier progenitor con profile.usageMode todavía null.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">¿Cómo vas a usar ALBA?</h1>
      <p className="mt-2 text-ink-soft">Esto nos ayuda a mostrarte la app como te sirve mejor.</p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <form action={setUsageModeAction}>
          <input type="hidden" name="as" value={as ?? ""} />
          <input type="hidden" name="usageMode" value="bilateral" />
          <button
            type="submit"
            className="w-full rounded-2xl border border-subtle bg-card p-5 text-left shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-sm font-semibold text-ink">Los dos progenitores</p>
            <p className="mt-1 text-xs text-ink-soft">
              Yo y el otro progenitor vamos a coordinarnos juntos en la app.
            </p>
          </button>
        </form>

        <form action={setUsageModeAction}>
          <input type="hidden" name="as" value={as ?? ""} />
          <input type="hidden" name="usageMode" value="unilateral" />
          <button
            type="submit"
            className="w-full rounded-2xl border border-subtle bg-card p-5 text-left shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <p className="text-sm font-semibold text-ink">Solo yo, por ahora</p>
            <p className="mt-1 text-xs text-ink-soft">
              Voy a usarla yo sola/solo para llevar el registro — puedo invitar al otro progenitor después.
            </p>
          </button>
        </form>
      </div>
    </div>
  );
}
