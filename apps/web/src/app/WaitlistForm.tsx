"use client";

import { useState } from "react";
import { joinWaitlistAction } from "./waitlistActions";

export function WaitlistForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await joinWaitlistAction(formData);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setPending(false);
  }

  if (success) {
    return (
      <div className="mt-6 rounded-2xl border border-subtle bg-card p-6 text-sm font-medium text-ink shadow-ambient">
        ¡Listo! Serás de los primeros en saber cuando la app esté lista.
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="mt-6 flex w-full flex-col gap-3 rounded-2xl border border-subtle bg-card p-6 text-left shadow-ambient sm:flex-row sm:items-start sm:gap-2"
    >
      <div className="flex-1">
        <label className="sr-only" htmlFor="waitlist-email">
          Correo
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          className="w-full rounded-xl border border-subtle bg-card px-4 py-2.5 text-base text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-ink-faint">
          Nunca compartimos tu correo. Te escribimos solo cuando haya cupo disponible.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-ambient transition-all hover:bg-orange-deep active:scale-[0.98] disabled:opacity-60 sm:mt-0"
      >
        {pending ? "Enviando…" : "Unirme a la lista de espera"}
      </button>
    </form>
  );
}
