"use client";

import { useState } from "react";
import { PROFILE_COLORS, AVATAR_KEYS, type AvatarKey } from "@alba/core";
import { COLOR_CLASS } from "@/lib/profileColors";
import { AVATAR_SRC, AVATAR_LABEL } from "@/lib/avatars";
import { upsertProfileAction } from "./actions";

export function SaveProfileForm({
  initialFullName,
  initialColor,
  initialAvatarKey,
}: {
  initialFullName: string;
  initialColor: string | null;
  initialAvatarKey: AvatarKey | null;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [color, setColor] = useState<string | null>(initialColor);
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(initialAvatarKey);

  async function handleSubmit(formData: FormData) {
    formData.set("color", color ?? "");
    formData.set("avatarKey", avatarKey ?? "");
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
        <p className="text-sm font-medium text-ink">Tu avatar</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={`Elegir avatar ${AVATAR_LABEL[key]}`}
              onClick={() => {
                setAvatarKey(key);
                setSaved(false);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 ${
                avatarKey === key ? "border-orange ring-2 ring-orange" : "border-subtle"
              }`}
            >
              <img
                src={AVATAR_SRC[key]}
                alt={AVATAR_LABEL[key]}
                className="h-12 w-12 rounded-full object-cover"
                style={{ objectPosition: "center 15%" }}
              />
              <span className="text-[10px] text-ink-soft">{AVATAR_LABEL[key]}</span>
            </button>
          ))}
        </div>
      </div>

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
              className={`h-8 w-8 rounded-full ${COLOR_CLASS[c]} ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`}
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
