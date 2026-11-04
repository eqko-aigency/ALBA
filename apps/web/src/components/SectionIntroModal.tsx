"use client";

import { useEffect, useRef, useState } from "react";
import { markSectionIntroSeenAction } from "@/app/actions/sectionIntroActions";

export type IntroPoint = {
  icon: React.ReactNode;
  iconBgClass: string;
  title: string;
  description: string;
};

export function SectionIntroModal({
  sectionKey,
  as,
  alreadySeen,
  hero,
  title,
  description,
  points,
}: {
  sectionKey: string;
  as?: string;
  alreadySeen: boolean;
  hero: React.ReactNode;
  title: string;
  description: string;
  points: IntroPoint[];
}) {
  const [open, setOpen] = useState(!alreadySeen);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!alreadySeen) {
      markSectionIntroSeenAction(sectionKey, as).catch(() => {});
    }
    // Solo al montar — "ya lo vio" se registra en el momento en que se le
    // mostró automáticamente, sin esperar a que lo cierre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cómo funciona ${title}`}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.6px] border-ink-soft text-[12px] font-bold italic text-ink-soft"
      >
        i
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative z-10 flex max-h-[calc(100%-36px)] w-full max-w-md flex-col overflow-y-auto rounded-t-[28px] px-[22px] pb-6 pt-3.5 outline-none"
            style={{ background: "#4a5a62" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="mb-2 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="mb-2.5 flex-shrink-0">{hero}</div>

            <p className="mb-1 text-[21px] font-extrabold tracking-tight text-white">{title.toUpperCase()}</p>
            <p className="mb-3 text-[12.5px] leading-snug text-white/70">{description}</p>
            <p className="mb-1.5 text-sm font-extrabold text-white">Así funciona</p>

            <div className="flex flex-col">
              {points.map((point, i) => (
                <div
                  key={point.title}
                  className={`flex gap-2.5 py-[7px] ${i < points.length - 1 ? "border-b border-white/10" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${point.iconBgClass}`}
                  >
                    {point.icon}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-bold text-white">{point.title}</p>
                    <p className="text-[11.5px] leading-snug text-white/70">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 flex-shrink-0 rounded-full bg-orange py-[11px] text-[13px] font-extrabold text-ink"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
