"use client";

import { useState } from "react";
import Link from "next/link";
import { signupAction } from "./actions";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await signupAction(formData);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setPending(false);
  }

  if (sent) {
    return (
      <div className="mt-8 w-full rounded-2xl border border-subtle bg-card p-6 text-left shadow-elevated">
        <p className="text-sm text-ink">
          Revisa tu correo y haz clic en el link de confirmación para activar tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="mt-8 flex w-full flex-col gap-4 rounded-2xl border border-subtle bg-card p-6 text-left shadow-elevated"
    >
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <div className="relative mt-1.5">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            className="w-full rounded-xl border border-subtle bg-card py-2.5 pl-10 pr-3 text-sm text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
          />
        </div>
      </label>
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
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-xl border border-subtle bg-card py-2.5 pl-10 pr-3 text-sm text-ink transition-colors outline-none focus:border-orange focus:ring-2 focus:ring-orange/25"
          />
        </div>
      </label>
      <label className="text-sm font-medium text-ink">
        Confirmar contraseña
        <div className="relative mt-1.5">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <Link href="/ingresar" className="text-center text-sm font-medium text-purple underline">
        ¿Ya tienes cuenta? Inicia sesión
      </Link>
    </form>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19.5c1.3-3.2 4-4.8 7-4.8s5.7 1.6 7 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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
