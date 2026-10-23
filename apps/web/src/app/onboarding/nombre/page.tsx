import { Wordmark } from "@/components/Wordmark";
import { getRequestContext } from "@/lib/repository";
import { confirmOnboardingNameAction } from "./actions";

export default async function OnboardingNombrePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const profile = await pairing.getProfile(parentId);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">
        Hola — ¿así está bien tu nombre?
      </h1>
      <p className="mt-2 text-ink-soft">Lo vamos a usar para que el otro progenitor sepa quién eres.</p>

      <form action={confirmOnboardingNameAction} className="mt-8 flex w-full flex-col gap-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <label htmlFor="fullName" className="sr-only">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={profile?.fullName ?? ""}
          className="w-full rounded-xl border border-subtle bg-card px-4 py-3 text-base text-ink"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-orange px-4 py-3 text-sm font-semibold text-ink shadow-ambient"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
