/**
 * Placeholder que se muestra EN EL INSTANTE en que Next.js empieza a
 * cargar una página (vía loading.tsx por ruta) — mientras el servidor
 * todavía está pidiendo datos a Supabase. Sin esto, la pantalla queda en
 * blanco (sin el menú de abajo, que vive en el mismo árbol que el
 * contenido) hasta que TODA la página termina de cargar, y entonces todo
 * aparece de golpe — eso es lo que se sentía como que "el menú se mueve o
 * cambia de tamaño" entre secciones, más notorio en Gastos por ser la
 * pantalla con más consultas en paralelo (gastos + pensión + hijos +
 * familia + balance).
 *
 * El mismo bloque de abajo (header con dos líneas + un par de tarjetas)
 * sirve para cualquier pantalla porque es genérico — no intenta
 * adivinar el contenido real, solo ocupa el espacio y dice "esto está
 * cargando" de inmediato.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-16 bg-sand">
      <div className="h-7 w-48 animate-pulse rounded-md bg-card" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded-md bg-card" />

      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-card" />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
        <div className="h-24 animate-pulse rounded-2xl bg-card" />
      </div>
    </div>
  );
}
