"use client";

import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center bg-sand">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Algo salió mal</h1>
      <p className="text-sm text-ink-soft">
        {error.message === "No hay sesión activa — inicia sesión para continuar."
          ? "Necesitas iniciar sesión para ver esto."
          : "Ocurrió un error inesperado. Intenta de nuevo o inicia sesión otra vez."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={retry}
          className="rounded-full border border-subtle bg-card px-4 py-2 text-sm font-medium text-ink"
        >
          Reintentar
        </button>
        <Link href="/ingresar" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink">
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
