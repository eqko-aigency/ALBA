"use client";

import { useState } from "react";
import { upsertProfileAction } from "./actions";

export function SaveProfileForm({ initialFullName }: { initialFullName: string }) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setSaved(false);
    await upsertProfileAction(formData);
    setPending(false);
    setSaved(true);
  }

  return (
    <form
      action={handleSubmit}
      onChange={() => setSaved(false)}
      className="mt-6 flex flex-col gap-3 rounded-lg border border-subtle bg-card p-5 shadow-ambient"
    >
      <label className="text-sm font-medium text-ink">
        Nombre completo
        <input
          name="parentFullName"
          autoComplete="off"
          required
          minLength={2}
          defaultValue={initialFullName}
          className="mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
        />
      </label>
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
