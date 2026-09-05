import Link from "next/link";

const items = [
  { href: "/chat", label: "Chat", enabled: true },
  { href: "#", label: "Calendario", enabled: false },
  { href: "#", label: "Gastos", enabled: false },
  { href: "#", label: "Documentos", enabled: false },
] as const;

export function AppNav({ active }: { active: "Chat" | "Calendario" | "Gastos" | "Documentos" }) {
  return (
    <nav className="flex gap-1 rounded-full bg-noche p-1">
      {items.map((item) =>
        item.enabled ? (
          <Link
            key={item.label}
            href={item.href}
            className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
              active === item.label ? "bg-coral text-[#4A1B0C]" : "text-bruma"
            }`}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            className="flex-1 rounded-full px-3 py-2 text-center text-xs font-medium text-bruma/40"
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  );
}
