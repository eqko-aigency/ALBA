import Link from "next/link";
import type { ComponentType } from "react";

export type SectionMenuItem = {
  href: string;
  label: string;
  accent: string;
  Icon: ComponentType<{ className?: string }>;
};

/** Menú de accesos rápidos (ícono + etiqueta + flecha) que baja con un
 * anchor link (#id) a una sección más abajo en la MISMA página — no
 * navega a otra ruta. Usado en Perfil y en el detalle de cada hijo/a para
 * que la información (antes solo visible bajando con el dedo) tenga un
 * punto de entrada rápido arriba. */
export function SectionMenu({ items }: { items: SectionMenuItem[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
      {items.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-subtle" : ""}`}
        >
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink ${item.accent}`}>
            <item.Icon className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-ink">{item.label}</span>
          <span className="ml-auto text-ink-faint" aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  );
}
