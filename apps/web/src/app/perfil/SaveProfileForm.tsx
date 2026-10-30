"use client";

import { useState } from "react";
import { PROFILE_COLORS } from "@alba/core";
import { upsertProfileAction } from "./actions";

const COLOR_SWATCH: Record<string, string> = {
  orange: "bg-orange",
  sky: "bg-sky",
  salmon: "bg-salmon",
  success: "bg-success",
  dawn: "bg-dawn",
  danger: "bg-danger",
};

export function SaveProfileForm({
  initialFullName,
  initialColor,
}: {
  initialFullName: string;
  initialColor: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);

  async function handleSubmit(formData: FormData) {
    formData.set("color", color ?? "");
    setPending(true);
    setSaved(false);
    await upsertProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  return (
    <form action={handleSubmit} onChange={() => setSaved(false)} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="parentFullName"
          autoComplete="off"
          required
          minLength={2}
          defaultValue={initialFullName}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-ink">Tu color en el Calendario</p>
        <div className="mt-2 flex gap-2">
          {PROFILE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Elegir color ${c}`}
              onClick={() => {
                setColor(c);
                setSaved(false);
              }}
              className={`h-8 w-8 rounded-full ${COLOR_SWATCH[c]} ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-orange px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="text-sm font-medium text-success">✓ Guardado</span>}
      </div>
    </form>
  );
}
