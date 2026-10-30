import type { ProfileColor } from "@alba/core";

/** Clase Tailwind por color de la paleta fija de perfil — única fuente de
 * verdad para que Perfil, Perfil de hijo/a y Calendario pinten el mismo
 * color exactamente igual (antes vivía duplicado en los tres). */
export const COLOR_CLASS: Record<ProfileColor, string> = {
  orange: "bg-orange",
  sky: "bg-sky",
  salmon: "bg-salmon",
  success: "bg-success",
  dawn: "bg-dawn",
  danger: "bg-danger",
};
