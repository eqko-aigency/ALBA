"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Botón de submit con feedback de "esto ya se está procesando" — sin esto,
 * tocar un botón (aprobar gasto, confirmar check-in, etc.) no mostraba
 * ningún cambio hasta que la página entera terminaba de recargar, y la
 * clienta no sabía si su toque había registrado o no. useFormStatus()
 * solo funciona en un componente HIJO del <form>, por eso es su propio
 * client component en vez de meter la lógica directo en cada página
 * (que son Server Components y no pueden usar hooks de React).
 */
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`disabled:opacity-60 ${className ?? ""}`}>
      {pending ? (pendingText ?? "Un momento…") : children}
    </button>
  );
}
