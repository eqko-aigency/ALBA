"use client";

import { useState } from "react";
import Link from "next/link";

export type QuickAction = {
  label: string;
  href: string;
  iconBgClass: string;
  icon: React.ReactNode;
};

export function QuickActionFab({ actions }: { actions: QuickAction[] }) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-[168px] right-5 z-30 flex flex-col items-end gap-3">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5"
            >
              <span className="whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-elevated">
                {action.label}
              </span>
              <span
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full shadow-elevated ${action.iconBgClass}`}
              >
                {action.icon}
              </span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Agregar"
        className="fixed bottom-[92px] right-5 z-30 flex h-[58px] w-[58px] items-center justify-center rounded-full border-4 border-white bg-orange shadow-elevated transition-transform"
        style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="#3a332e" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
