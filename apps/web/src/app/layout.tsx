import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/** Tipografía del wordmark "alba" — docs/design/Presentación Logo Alba.pdf.
 * Reservada para el logotipo, no para texto de UI. */
const albaWordmark = localFont({
  src: "./fonts/alba-wordmark.ttf",
  variable: "--font-alba-wordmark",
});

export const metadata: Metadata = {
  title: "ALBA",
  description: "App de coparentalidad",
};

// viewportFit "cover" es lo que hace que env(safe-area-inset-bottom) deje de
// ser 0 en iOS Safari — sin esto, el bottom nav flotante de AppNav.tsx queda
// pegado al borde real de la pantalla, por debajo de la barra/gesto de
// Safari, en vez de respetar esa zona segura.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${jetbrainsMono.variable} ${albaWordmark.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
