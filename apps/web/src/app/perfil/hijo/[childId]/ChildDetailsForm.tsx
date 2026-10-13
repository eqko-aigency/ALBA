"use client";

import { useState } from "react";
import type { ChildContact } from "@alba/core";
import { ContactsIcon, HealthIcon, NotesIcon, SchoolIcon } from "@/components/icons";
import { updateChildDetailsAction } from "../../actions";

const inputClass =
  "mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink";
const labelClass = "text-sm font-medium text-ink";

function AccordionHeader({
  label,
  accent,
  Icon,
}: {
  label: string;
  accent: string;
  Icon: typeof ContactsIcon;
}) {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-ink ${accent}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90" aria-hidden="true">→</span>
    </summary>
  );
}

export function ChildDetailsForm({
  childId,
  initial,
}: {
  childId: string;
  initial: {
    contacts: ChildContact[];
    therapistName: string | null;
    therapistPhone: string | null;
    schoolName: string | null;
    schoolContact: string | null;
    allergies: string | null;
    specialNotes: string | null;
    sleepRoutine: string | null;
  };
}) {
  const [contacts, setContacts] = useState<ChildContact[]>(initial.contacts);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateContact(index: number, field: keyof ChildContact, value: string) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    setSaved(false);
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: "", relation: "", phone: "" }]);
    setSaved(false);
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSubmit(formData: FormData) {
    const cleanContacts = contacts.filter((c) => c.name.trim().length > 0);
    formData.set("contactsJson", JSON.stringify(cleanContacts));
    setPending(true);
    setSaved(false);
    await updateChildDetailsAction(formData);
    setPending(false);
    setSaved(true);
  }

  return (
    <form action={handleSubmit} onChange={() => setSaved(false)} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="childId" value={childId} />

      {/* Mismo patrón de acordeón que el menú de Perfil — nada se ve hasta
          que lo tocas, en vez de las 4 secciones siempre abiertas de antes. */}
      <div className="overflow-hidden rounded-2xl border border-subtle bg-card shadow-ambient">
        <details className="group">
          <AccordionHeader label="Contactos" accent="bg-salmon" Icon={ContactsIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">Terapeuta, maestra, familiares — cualquiera relevante para este hijo/a.</p>
            <div className="mt-4 flex flex-col gap-3">
              {contacts.map((contact, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Contacto {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className="text-xs font-medium text-danger underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <input
                    value={contact.name}
                    onChange={(e) => updateContact(i, "name", e.target.value)}
                    placeholder="Nombre"
                    className={inputClass}
                  />
                  <input
                    value={contact.relation}
                    onChange={(e) => updateContact(i, "relation", e.target.value)}
                    placeholder="Relación (ej. Terapeuta, Tía)"
                    className={inputClass}
                  />
                  <input
                    value={contact.phone}
                    onChange={(e) => updateContact(i, "phone", e.target.value)}
                    placeholder="Teléfono"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addContact}
                className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink"
              >
                + Agregar contacto
              </button>
            </div>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Salud" accent="bg-sky" Icon={HealthIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                Terapeuta — nombre
                <input name="therapistName" defaultValue={initial.therapistName ?? ""} className={inputClass} />
              </label>
              <label className={labelClass}>
                Terapeuta — teléfono
                <input name="therapistPhone" defaultValue={initial.therapistPhone ?? ""} className={inputClass} />
              </label>
              <label className={labelClass}>
                Alergias
                <textarea name="allergies" defaultValue={initial.allergies ?? ""} rows={2} className={inputClass} />
              </label>
            </div>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Escuela" accent="bg-dawn" Icon={SchoolIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                Nombre de la escuela
                <input name="schoolName" defaultValue={initial.schoolName ?? ""} className={inputClass} />
              </label>
              <label className={labelClass}>
                Contacto de la escuela
                <input name="schoolContact" defaultValue={initial.schoolContact ?? ""} className={inputClass} />
              </label>
            </div>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Notas especiales" accent="bg-purple" Icon={NotesIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <div className="flex flex-col gap-3">
              <label className={labelClass}>
                Rutina de sueño
                <textarea
                  name="sleepRoutine"
                  defaultValue={initial.sleepRoutine ?? ""}
                  rows={2}
                  placeholder="Ej. duerme con el conejo azul, se acuesta a las 8pm..."
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Otras notas
                <textarea
                  name="specialNotes"
                  defaultValue={initial.specialNotes ?? ""}
                  rows={3}
                  placeholder="Cualquier dato que el otro progenitor deba saber"
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </details>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-ink shadow-ambient disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar notas"}
        </button>
        {saved && <span className="text-sm font-medium text-success">✓ Guardado</span>}
      </div>
    </form>
  );
}
