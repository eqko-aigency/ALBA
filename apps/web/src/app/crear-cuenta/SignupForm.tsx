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
      <div className="mt-6 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <p className="text-sm text-ink">
          Revisa tu correo y haz clic en el link de confirmación para activar tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="mt-6 flex flex-col gap-3 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="text-sm font-medium text-ink">
        Confirmar contraseña
        <input
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <Link href="/ingresar" className="text-sm font-medium text-purple underline">
        ¿Ya tienes cuenta? Inicia sesión
      </Link>
    </form>
  );
}
