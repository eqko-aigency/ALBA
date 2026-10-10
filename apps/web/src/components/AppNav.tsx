import Link from "next/link";

type NavLabel = "Registro" | "Perfil" | "Chat" | "Calendario" | "Gastos" | "Bóveda";

const items: { href: string; label: NavLabel; enabled: boolean }[] = [
  { href: "/registro", label: "Registro", enabled: true },
  { href: "/perfil", label: "Perfil", enabled: true },
  { href: "/chat", label: "Chat", enabled: true },
  { href: "/calendario", label: "Calendario", enabled: true },
  { href: "/gastos", label: "Gastos", enabled: true },
  { href: "/boveda", label: "Bóveda", enabled: true },
];

function NavIcon({ label }: { label: NavLabel }) {
  const common = { viewBox: "0 0 24 24", fill: "none", className: "h-5 w-5", "aria-hidden": true } as const;
  switch (label) {
    case "Registro":
      return (
        <svg {...common}>
          <path
            d="M10 13a4 4 0 005.66 0l2.83-2.83a4 4 0 10-5.66-5.66l-1.5 1.5M14 11a4 4 0 00-5.66 0l-2.83 2.83a4 4 0 105.66 5.66l1.5-1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Perfil":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M5 19.5c1.3-3.2 4-4.8 7-4.8s5.7 1.6 7 4.8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "Chat":
      return (
        <svg {...common}>
          <path
            d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Calendario":
      return (
        <svg {...common}>
          <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "Gastos":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M14.5 9.5c-.4-.8-1.3-1.3-2.5-1.3-1.5 0-2.7.8-2.7 2s1.2 1.8 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 7.3v9.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "Bóveda":
      return (
        <svg {...common}>
          <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M8 10.5V7.8a4 4 0 118 0v2.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export function AppNav({ active }: { active?: NavLabel }) {
  return (
    <nav
      className="fixed inset-x-4 z-20 mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-2xl bg-card px-1.5 py-1.5 shadow-elevated"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const isActive = active === item.label;
        if (!item.enabled) {
          return (
            <span
              key={item.label}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-ink-faint/60"
            >
              <NavIcon label={item.label} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors ${
              isActive ? "bg-orange text-ink" : "text-ink-soft"
            }`}
          >
            <NavIcon label={item.label} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
