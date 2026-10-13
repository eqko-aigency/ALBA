import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/repository";
import { AppNav } from "@/components/AppNav";
import { ChildDetailsForm } from "./ChildDetailsForm";

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const { pairing, parentId } = await getRequestContext();
  const children = await pairing.getMyChildren(parentId);
  const child = children.find((c) => c.id === childId);

  if (!child) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      <Link
        href="/perfil"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-subtle bg-card px-4 py-2 text-sm font-semibold text-ink shadow-ambient transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <span aria-hidden="true">←</span> Volver a Perfil
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{child.fullName}</h1>
      <p className="mt-2 text-ink-soft">
        Datos que ayudan al otro progenitor (y a quien cuide a {child.fullName.split(" ")[0]}) a hacer bien su parte.
      </p>

      <ChildDetailsForm
        childId={child.id}
        initial={{
          contacts: child.contacts,
          therapistName: child.therapistName,
          therapistPhone: child.therapistPhone,
          schoolName: child.schoolName,
          schoolContact: child.schoolContact,
          allergies: child.allergies,
          specialNotes: child.specialNotes,
          sleepRoutine: child.sleepRoutine,
        }}
      />

      <AppNav active="Perfil" />
    </div>
  );
}
