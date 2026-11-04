import Link from "next/link";

type NavLabel = "Inicio" | "Chat" | "Calendario" | "Más";

const items: { href: string; label: NavLabel; enabled: boolean }[] = [
  { href: "/dashboard", label: "Inicio", enabled: true },
  { href: "/chat", label: "Chat", enabled: true },
  { href: "/calendario", label: "Calendario", enabled: true },
  { href: "/mas", label: "Más", enabled: true },
];

function NavIcon({ label }: { label: NavLabel }) {
  const common = { viewBox: "0 0 24 24", fill: "none", className: "h-5 w-5", "aria-hidden": true } as const;
  switch (label) {
    case "Inicio":
      return (
        <svg {...common}>
          <path
            d="M4 11l8-6.5L20 11M6 9.5V19a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1V9.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
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
    case "Más":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

export function AppNav({ active }: { active?: NavLabel }) {
  return (
    <nav
      className="fixed inset-x-2 z-20 mx-auto flex max-w-md items-stretch justify-between rounded-2xl bg-card px-1 py-1.5 shadow-elevated"
      // translateZ(0) fuerza su propia capa de composición: evita el parpadeo
      // de iOS Safari al hacer scroll con position: fixed + safe-area-inset.
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))", transform: "translateZ(0)" }}
    >
      {items.map((item) => {
        const isActive = active === item.label;
        if (!item.enabled) {
          return (
            <span key={item.label} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-ink-faint/60">
              <span className="flex h-7 w-7 items-center justify-center">
                <NavIcon label={item.label} />
              </span>
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 transition-colors ${
              isActive ? "text-ink" : "text-ink-soft"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isActive ? "bg-orange" : ""
              }`}
            >
              <NavIcon label={item.label} />
            </span>
            <span className={`text-[9px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
