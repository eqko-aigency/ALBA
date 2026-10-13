import { AppNav } from "@/components/AppNav";

/**
 * Esqueleto propio (no PageSkeleton genérico) porque un hilo de chat no se
 * parece a una pantalla de tarjetas — es una cabecera + mensajes + un
 * composer, mismo layout que la página real para que no "salte" al
 * terminar de cargar.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-sand">
      <div className="sticky top-0 z-10 border-b border-subtle bg-card px-4 py-3 shadow-ambient">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-sand" />
          <div className="flex-1">
            <div className="h-4 w-32 animate-pulse rounded bg-sand" />
            <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-sand" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="h-12 w-2/3 animate-pulse self-start rounded-2xl bg-card" />
        <div className="h-12 w-1/2 animate-pulse self-end rounded-2xl bg-card" />
        <div className="h-12 w-3/5 animate-pulse self-start rounded-2xl bg-card" />
      </div>

      <div
        className="sticky bg-sand px-4 pb-6 pt-2"
        style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="h-16 animate-pulse rounded-2xl bg-card" />
      </div>

      <AppNav active="Chat" />
    </div>
  );
}
