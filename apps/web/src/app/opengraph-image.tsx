import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen de vista previa al compartir el link (WhatsApp, iMessage, redes)
 * — sin esto, esos clientes caían en un ícono genérico de Vercel. No usa
 * la tipografía del wordmark (ImageResponse no puede cargar fuentes
 * locales del proyecto sin leerlas como buffer); se aproxima con serif. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E5DCD3",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, #F79A7A 0%, transparent 35%), radial-gradient(circle at 85% 75%, #A4BED5 0%, transparent 35%)",
        }}
      >
        <div
          style={{
            fontSize: 180,
            fontFamily: "serif",
            color: "#3A332E",
          }}
        >
          alba
        </div>
        <div style={{ fontSize: 32, color: "#6B5F57", marginTop: 8 }}>App de coparentalidad</div>
      </div>
    ),
    { ...size }
  );
}
