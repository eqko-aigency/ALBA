import type { MetadataRoute } from "next";

/**
 * Next.js genera /manifest.webmanifest a partir de esto. Hace falta para
 * que el celular pueda instalar ALBA como app (ícono en la pantalla de
 * inicio) — en iPhone, Safari SOLO manda push notifications a apps
 * instaladas así, nunca a una pestaña normal del navegador.
 *
 * icon-192.png/icon-512.png (public/) están renderizados a propósito con
 * la tipografía real del wordmark de marca (alba-wordmark.ttf) a esa
 * resolución — no son una ampliación del favicon de 32px, que se veía
 * pixeleado al usarse como ícono de pantalla de inicio.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ALBA — App de coparentalidad",
    short_name: "ALBA",
    description: "App de coparentalidad",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#E5DCD3",
    theme_color: "#F79A7A",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
