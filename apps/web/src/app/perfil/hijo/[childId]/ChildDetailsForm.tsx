"use client";

import { useState } from "react";
import type { ChildContact, ChildHealthProvider, ChildNote, ChildSchoolContact } from "@alba/core";
import { PROFILE_COLORS } from "@alba/core";
import { ContactsIcon, HealthIcon, NotesIcon, SchoolIcon } from "@/components/icons";
import { updateChildDetailsAction } from "../../actions";

const inputClass =
  "mt-1 w-full rounded-md border border-subtle bg-card px-3 py-2 text-base text-ink";
const labelClass = "text-sm font-medium text-ink";

const COLOR_SWATCH: Record<string, string> = {
  orange: "bg-orange",
  sky: "bg-sky",
  salmon: "bg-salmon",
  success: "bg-success",
  dawn: "bg-dawn",
  danger: "bg-danger",
};

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
    healthProviders: ChildHealthProvider[];
    schoolName: string | null;
    schoolContacts: ChildSchoolContact[];
    allergies: string | null;
    notes: ChildNote[];
    color: string | null;
  };
}) {
  const [contacts, setContacts] = useState<ChildContact[]>(initial.contacts);
  const [healthProviders, setHealthProviders] = useState<ChildHealthProvider[]>(initial.healthProviders);
  const [schoolContacts, setSchoolContacts] = useState<ChildSchoolContact[]>(initial.schoolContacts);
  const [notes, setNotes] = useState<ChildNote[]>(initial.notes);
  const [color, setColor] = useState<string | null>(initial.color);
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

  function updateHealthProvider(index: number, field: keyof ChildHealthProvider, value: string) {
    setHealthProviders((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    setSaved(false);
  }

  function addHealthProvider() {
    setHealthProviders((prev) => [...prev, { role: "", name: "", phone: "" }]);
    setSaved(false);
  }

  function removeHealthProvider(index: number) {
    setHealthProviders((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function updateSchoolContact(index: number, field: keyof ChildSchoolContact, value: string) {
    setSchoolContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    setSaved(false);
  }

  function addSchoolContact() {
    setSchoolContacts((prev) => [...prev, { role: "", name: "", phone: "" }]);
    setSaved(false);
  }

  function removeSchoolContact(index: number) {
    setSchoolContacts((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function updateNote(index: number, field: keyof ChildNote, value: string) {
    setNotes((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
    setSaved(false);
  }

  function addNote() {
    setNotes((prev) => [...prev, { label: "", text: "" }]);
    setSaved(false);
  }

  function removeNote(index: number) {
    setNotes((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSubmit(formData: FormData) {
    const cleanContacts = contacts.filter((c) => c.name.trim().length > 0);
    const cleanHealthProviders = healthProviders.filter((p) => p.role.trim().length > 0 && p.name.trim().length > 0);
    const cleanSchoolContacts = schoolContacts.filter((c) => c.role.trim().length > 0 && c.name.trim().length > 0);
    const cleanNotes = notes.filter((n) => n.label.trim().length > 0 && n.text.trim().length > 0);
    formData.set("contactsJson", JSON.stringify(cleanContacts));
    formData.set("healthProvidersJson", JSON.stringify(cleanHealthProviders));
    formData.set("schoolContactsJson", JSON.stringify(cleanSchoolContacts));
    formData.set("notesJson", JSON.stringify(cleanNotes));
    formData.set("color", color ?? "");
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
            <p className="text-xs text-ink-soft">
              Pediatra, dentista, terapeuta... agrega los rubros que necesites, no solo uno fijo.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {healthProviders.map((provider, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Profesional {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeHealthProvider(i)}
                      className="text-xs font-medium text-danger underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <input
                    value={provider.role}
                    onChange={(e) => updateHealthProvider(i, "role", e.target.value)}
                    placeholder="Rubro (ej. Pediatra, Dentista, Terapeuta)"
                    className={inputClass}
                  />
                  <input
                    value={provider.name}
                    onChange={(e) => updateHealthProvider(i, "name", e.target.value)}
                    placeholder="Nombre"
                    className={inputClass}
                  />
                  <input
                    value={provider.phone}
                    onChange={(e) => updateHealthProvider(i, "phone", e.target.value)}
                    placeholder="Teléfono"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addHealthProvider}
                className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink"
              >
                + Agregar profesional
              </button>
            </div>
            <label className={`${labelClass} mt-4 block`}>
              Alergias
              <textarea name="allergies" defaultValue={initial.allergies ?? ""} rows={2} className={inputClass} />
            </label>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Escuela" accent="bg-dawn" Icon={SchoolIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <label className={labelClass}>
              Nombre de la escuela
              <input name="schoolName" defaultValue={initial.schoolName ?? ""} className={inputClass} />
            </label>

            <p className="mt-4 text-xs text-ink-soft">
              Maestra, dirección, psicóloga escolar... agrega los contactos que necesites.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {schoolContacts.map((contact, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Contacto {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSchoolContact(i)}
                      className="text-xs font-medium text-danger underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <input
                    value={contact.role}
                    onChange={(e) => updateSchoolContact(i, "role", e.target.value)}
                    placeholder="Rubro (ej. Maestra titular, Dirección)"
                    className={inputClass}
                  />
                  <input
                    value={contact.name}
                    onChange={(e) => updateSchoolContact(i, "name", e.target.value)}
                    placeholder="Nombre"
                    className={inputClass}
                  />
                  <input
                    value={contact.phone}
                    onChange={(e) => updateSchoolContact(i, "phone", e.target.value)}
                    placeholder="Teléfono"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addSchoolContact}
                className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink"
              >
                + Agregar contacto
              </button>
            </div>
          </div>
        </details>

        <details className="group border-t border-subtle">
          <AccordionHeader label="Notas especiales" accent="bg-purple" Icon={NotesIcon} />
          <div className="border-t border-subtle px-4 pb-5 pt-4">
            <p className="text-xs text-ink-soft">
              Rutina de sueño, miedos, comida favorita... agrega las notas que necesites, con el título que quieras.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {notes.map((note, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md border border-subtle p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-soft">Nota {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeNote(i)}
                      className="text-xs font-medium text-danger underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <input
                    value={note.label}
                    onChange={(e) => updateNote(i, "label", e.target.value)}
                    placeholder="Título (ej. Rutina de sueño, Miedo a los perros)"
                    className={inputClass}
                  />
                  <textarea
                    value={note.text}
                    onChange={(e) => updateNote(i, "text", e.target.value)}
                    rows={2}
                    placeholder="Detalle"
                    className={inputClass}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addNote}
                className="self-start rounded-full border border-subtle px-3 py-1.5 text-xs font-semibold text-ink"
              >
                + Agregar nota
              </button>
            </div>
          </div>
        </details>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Color en el Calendario</p>
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
