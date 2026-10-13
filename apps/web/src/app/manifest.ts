import type { MetadataRoute } from "next";

/**
 * Next.js genera /manifest.webmanifest a partir de esto. Hace falta para
 * que el celular pueda instalar ALBA como app (ícono en la pantalla de
 * inicio) — en iPhone, Safari SOLO manda push notifications a apps
 * instaladas así, nunca a una pestaña normal del navegador.
 *
 * Los íconos reusan app/icon.svg (32x32, el mismo del favicon) — se ve
 * bien en la pestaña del navegador pero es chico para un ícono de
 * pantalla de inicio; lo ideal a futuro es un PNG de 192x192 y 512x512
 * hechos a propósito, no una ampliación del favicon.
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
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
