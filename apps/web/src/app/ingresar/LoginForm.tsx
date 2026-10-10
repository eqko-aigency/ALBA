"use client";

import { useState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await loginAction(formData);
    if (result?.error) {
      setError(result.error);
    }
    setPending(false);
  }

  return (
    <form
      action={handleSubmit}
      className="mt-8 flex w-full flex-col gap-4 rounded-2xl border border-subtle bg-card p-6 text-left shadow-elevated"
    >
      <label className="text-sm font-medium text-ink">
        Email
        <div className="relative mt-1.5">
          <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-subtle bg-card py-2.5 pl-10 pr-3 text-sm text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
          />
        </div>
      </label>
      <label className="text-sm font-medium text-ink">
        Contraseña
        <div className="relative mt-1.5">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-subtle bg-card py-2.5 pl-10 pr-3 text-sm text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
          />
        </div>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-orange px-4 py-3 text-sm font-semibold text-ink shadow-ambient transition-all hover:bg-orange-deep active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
      <Link href="/crear-cuenta" className="text-center text-sm font-medium text-purple underline">
        ¿No tienes cuenta? Crea una
      </Link>
    </form>
  );
}

function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 7l7.5 5.5L19.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10.5V7.8a4 4 0 118 0v2.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
