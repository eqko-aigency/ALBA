import Link from "next/link";
import { getRequestContext } from "@/lib/repository";
import { isDemoMode } from "@/lib/demoSession";
import { AppNav } from "@/components/AppNav";
import { uploadDocumentAction, anchorPendingDocumentsAction } from "./actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...`;
}

export default async function BovedaPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { documents, pairing, parentId } = await getRequestContext(as);

  const [documentList, familyMembers] = await Promise.all([
    documents.listDocuments(parentId),
    pairing.listFamilyMembers(parentId),
  ]);

  const parentName = (id: string) =>
    id === parentId ? "Tú" : familyMembers.find((p) => p.id === id)?.fullName ?? "El otro progenitor";

  const pendingCount = documentList.filter((d) => d.anchorStatus === "pending").length;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      {isDemoMode && (
        <p className="mb-6 rounded-md border border-orange bg-dawn px-4 py-2 text-sm text-ink">
          Modo de prueba local — viendo como Progenitor {as === "b" ? "B" : "A"}.{" "}
          <Link href={as === "b" ? "/boveda" : "/boveda?as=b"} className="underline">
            Cambiar a Progenitor {as === "b" ? "A" : "B"}
          </Link>
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Bóveda</h1>
      <p className="mt-2 text-ink-soft">
        Documentos y acuerdos básicos, con evidencia digital — hash SHA-256 y anclaje (POC) de Merkle Tree.
      </p>

      {pendingCount > 0 && (
        <form action={anchorPendingDocumentsAction} className="mt-6">
          <input type="hidden" name="as" value={as ?? ""} />
          <button
            type="submit"
            className="w-full rounded-full bg-purple px-4 py-3 text-sm font-semibold text-ink shadow-ambient"
          >
            Anclar documentos pendientes ({pendingCount})
          </button>
          <p className="mt-2 text-center text-xs text-ink-faint">
            Calcula una raíz Merkle sobre los hashes de todos los documentos pendientes y los marca como anclados.
          </p>
        </form>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-subtle bg-card shadow-ambient">
        {documentList.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Todavía no hay documentos en la Bóveda.</p>
        ) : (
          documentList.map((doc, i) => (
            <div key={doc.id} className={`p-4 ${i > 0 ? "border-t border-subtle" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{doc.title}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Subió {parentName(doc.uploadedByParentId)} · {formatDate(doc.createdAt)}
                  </p>
                  <p
                    className="mt-1 font-mono text-xs text-ink-soft"
                    title={doc.sha256Hex}
                    aria-label={`Hash SHA-256 completo: ${doc.sha256Hex}`}
                  >
                    <span aria-hidden="true">SHA-256: {truncateHash(doc.sha256Hex)}</span>
                  </p>
                  {doc.anchorStatus === "anchored" && doc.anchorReference && (
                    <p className="mt-1 break-all font-mono text-[11px] text-ink-faint" title={doc.anchorReference}>
                      Ref. de anclaje: {doc.anchorReference}
                    </p>
                  )}
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-purple underline"
                  >
                    Ver documento
                  </a>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    doc.anchorStatus === "anchored"
                      ? "bg-success/20 text-ink"
                      : "border border-orange bg-dawn text-ink"
                  }`}
                >
                  {doc.anchorStatus === "anchored" ? "Anclado ✓" : "Pendiente"}
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="mt-8 rounded-lg border border-subtle bg-card p-5 shadow-ambient">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Nuevo documento</h2>

        <form action={uploadDocumentAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="as" value={as ?? ""} />

          <input
            type="text"
            name="title"
            required
            minLength={3}
            maxLength={160}
            placeholder="Título (ej. Convenio de custodia firmado, acta de nacimiento...)"
            className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink"
          />

          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-xs font-medium text-ink-soft">Archivo (PDF, imagen o Word)</label>
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/*,.doc,.docx"
              className="w-full min-w-0 rounded-md border border-subtle bg-card px-3 py-2 text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink"
            />
          </div>

          <button type="submit" className="mt-1 self-start rounded-full bg-salmon px-4 py-2 text-sm font-semibold text-ink">
            Subir documento
          </button>
        </form>
      </section>

      <AppNav active="Bóveda" />
    </div>
  );
}
