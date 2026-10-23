"use client";

import { useRef, useState } from "react";
import { uploadDocumentAction } from "./actions";

/**
 * Antes era un <form action={uploadDocumentAction}> directo en un Server
 * Component — cualquier error (título corto, sin familia, falla de
 * Storage) tronaba al error boundary genérico sin explicación, y no había
 * forma explícita de tomar una foto con la cámara del celular (solo lo que
 * el picker nativo del navegador decidiera ofrecer). Este componente
 * cliente agrega ambas cosas: mensaje de error inline y un botón
 * "Tomar foto" (capture="environment") separado de "Elegir archivo".
 *
 * title/childId son inputs CONTROLADOS a propósito: con action={fn} en un
 * <form>, React resetea los campos no controlados cuando la acción
 * termina (éxito o error) — confirmado en vivo probando esta pantalla: un
 * intento fallido (ej. sin archivo) borraba el título ya escrito, aunque
 * el formulario seguía visible. Mantener el valor en estado evita que la
 * usuaria tenga que volver a escribirlo después de un error.
 */
export function UploadDocumentForm({
  as,
  children,
}: {
  as: string;
  children: { id: string; fullName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [childId, setChildId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  }

  async function handleSubmit(formData: FormData) {
    if (!file) {
      setError("Selecciona un archivo o toma una foto — en Bóveda el documento siempre se sube de verdad.");
      return;
    }
    formData.set("file", file);
    setPending(true);
    setError(null);
    const result = await uploadDocumentAction(formData);
    if ("error" in result) {
      setError(result.error);
    } else {
      setTitle("");
      setChildId("");
      setFile(null);
    }
    setPending(false);
  }

  return (
    <form action={handleSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="as" value={as} />

      <input
        type="text"
        name="title"
        required
        minLength={3}
        maxLength={160}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (ej. Convenio de custodia firmado, acta de nacimiento...)"
        className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
      />

      {children.length > 0 && (
        <select
          name="childId"
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink"
        >
          <option value="">General (toda la familia)</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <label className="text-xs font-medium text-ink-soft">Archivo (PDF, imagen o Word)</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-semibold text-ink"
          >
            Tomar foto
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-subtle bg-card px-3 py-1.5 text-xs font-semibold text-ink"
          >
            Elegir archivo
          </button>
          {file && <span className="truncate text-xs text-ink-soft">{file.name}</span>}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*,.doc,.docx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "Subiendo…" : "Subir documento"}
      </button>
    </form>
  );
}
