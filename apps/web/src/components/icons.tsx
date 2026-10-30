/** Set de íconos compartido (Dashboard, portada) — trazo delgado,
 * currentColor, mismo lenguaje visual que NavIcon en AppNav.tsx. Separado
 * de AppNav porque ahí los íconos van siempre a 20x20 dentro del nav fijo;
 * acá se usan más grandes, dentro de chips de color en tarjetas. */
type IconProps = { className?: string };
const common = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

export function ClockIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path
        d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.1 0-2.2-.2-3.1-.6L4 20l1.1-4.3C4.4 14.5 4 13.3 4 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GastosIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.5 9.5c-.4-.8-1.3-1.3-2.5-1.3-1.5 0-2.7.8-2.7 2s1.2 1.8 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 7.3v9.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BovedaIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V7.8a4 4 0 118 0v2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ContactsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 6a3 3 0 010 6M18 19c-.6-2-1.6-3.4-3-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function HealthIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path
        d="M12 19s-7-4.2-7-9.3C5 6.7 7 5 9.2 5c1.2 0 2.2.6 2.8 1.6C12.6 5.6 13.6 5 14.8 5 17 5 19 6.7 19 9.7 19 14.8 12 19 12 19z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 10h2l1-2 1.5 4 1-2h1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SchoolIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M3 9.5L12 5l9 4.5-9 4.5-9-4.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 11.5V16c0 1.1 2.2 2 5 2s5-.9 5-2v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 9.5V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function NotesIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19.5c1.3-3.2 4-4.8 7-4.8s5.7 1.6 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function UsageModeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="8" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 18c.8-2.6 2.6-4 5-4s4.2 1.4 5 4M11 18c.8-2.6 2.6-4 5-4s4.2 1.4 5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path
        d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PinIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path
        d="M12 21s7-6.2 7-11.5A7 7 0 105 9.5C5 14.8 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function StarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path
        d="M12 3.5l2.4 5.1 5.5.7-4 3.9.9 5.6-4.8-2.6-4.8 2.6.9-5.6-4-3.9 5.5-.7L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlagIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M6 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6 4h10l-2.2 3.5L16 11H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
