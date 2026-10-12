"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink shadow-ambient"
    >
      Imprimir / Guardar como PDF
    </button>
  );
}
