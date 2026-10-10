import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

const items = [
  { href: "/registro", label: "Registro", enabled: true },
  { href: "/perfil", label: "Perfil", enabled: true },
  { href: "/chat", label: "Acuerdo", enabled: true },
  { href: "/calendario", label: "Calendario", enabled: true },
  { href: "#", label: "Gastos", enabled: false },
  { href: "#", label: "Bóveda", enabled: false },
] as const;

export function AppNav({
  active,
}: {
  active?: "Registro" | "Perfil" | "Acuerdo" | "Calendario" | "Gastos" | "Bóveda";
}) {
  return (
    <div className="flex items-center gap-2">
      <nav className="flex flex-1 gap-1 rounded-full bg-ink p-1">
        {items.map((item) =>
          item.enabled ? (
            <Link
              key={item.label}
              href={item.href}
              className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
                active === item.label ? "bg-orange text-ink" : "text-sand"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.label}
              className="flex-1 rounded-full px-3 py-2 text-center text-xs font-medium text-sand/40"
            >
              {item.label}
            </span>
          )
        )}
      </nav>
      <LogoutButton />
    </div>
  );
}
