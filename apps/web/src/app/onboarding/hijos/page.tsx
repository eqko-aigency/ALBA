import { Wordmark } from "@/components/Wordmark";
import { createChildAction, skipChildrenStepAction } from "./actions";

export default async function OnboardingHijosPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Agrega a tus hijos</h1>
      <p className="mt-2 text-ink-soft">Nombre y fecha de nacimiento — el resto se llena después, en Perfil.</p>

      <form action={createChildAction} className="mt-8 flex w-full flex-col gap-3 text-left">
        <input type="hidden" name="as" value={as ?? ""} />
        <label className="text-sm font-medium text-ink">
          Nombre completo
          <input
            name="childFullName"
            autoComplete="off"
            required
            minLength={2}
            className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
          />
        </label>
        <label className="text-sm font-medium text-ink">
          Fecha de nacimiento
          <div className="mt-1 w-full overflow-hidden rounded-md border border-subtle bg-card">
            <input
              name="childBirthDate"
              type="date"
              autoComplete="off"
              required
              className="w-full min-w-0 bg-card px-3 py-2 text-base text-ink"
            />
          </div>
        </label>
        <button type="submit" className="mt-1 rounded-full bg-salmon px-4 py-3 text-sm font-semibold text-ink">
          Agregar hijo/a
        </button>
      </form>

      <form action={skipChildrenStepAction} className="mt-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <button type="submit" className="text-sm font-medium text-ink-soft underline">
          Hacerlo después
        </button>
      </form>
    </div>
  );
}
