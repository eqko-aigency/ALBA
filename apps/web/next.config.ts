import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default de Server Actions es 1MB — muy chico para los documentos/fotos
  // que se suben en Bóveda y como comprobante en Gastos, causaba que la
  // subida fallara en silencio ("no me dejó subir el documento").
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
