import Link from "next/link";

const items = [
  { href: "/chat", label: "Acuerdo", enabled: true },
  { href: "#", label: "Calendario", enabled: false },
  { href: "#", label: "Gastos", enabled: false },
  { href: "#", label: "Bóveda", enabled: false },
] as const;

export function AppNav({ active }: { active: "Acuerdo" | "Calendario" | "Gastos" | "Bóveda" }) {
  return (
    <nav className="flex gap-1 rounded-full bg-ink p-1">
      {items.map((item) =>
        item.enabled ? (
          <Link
            key={item.label}
            href={item.href}
            className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
              active === item.label ? "bg-sandstone text-white" : "text-canvas"
            }`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            className="flex-1 rounded-full px-3 py-2 text-center text-xs font-medium text-canvas/40"
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  );
}
