import { Wordmark } from "@/components/Wordmark";
import { setWhatsappNumberAction } from "./actions";

export default async function OnboardingWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center bg-sand">
      <Wordmark className="text-6xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Tu número de WhatsApp</h1>
      <p className="mt-2 text-ink-soft">
        Déjanos tu número — en cuanto esta función esté lista, el otro progenitor podrá escribir ahí y los
        mensajes llegarán a tu ALBA.
      </p>

      <form action={setWhatsappNumberAction} className="mt-8 flex w-full flex-col gap-3">
        <input type="hidden" name="as" value={as ?? ""} />
        <label htmlFor="whatsappNumber" className="sr-only">
          Número de WhatsApp
        </label>
        <input
          id="whatsappNumber"
          name="whatsappNumber"
          type="tel"
          autoComplete="tel"
          required
          minLength={7}
          maxLength={20}
          placeholder="55 1234 5678"
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
