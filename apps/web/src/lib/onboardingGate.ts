import { cookies } from "next/headers";
import type { Parent } from "@alba/core";

export type OnboardingStep = "nombre" | "modo" | "hijos" | "invitar" | "whatsapp";

/**
 * Único lugar que decide "a qué paso del wizard falta mandar a este
 * progenitor" — cada paso, al terminar o al saltarse con "Hacerlo después",
 * redirige de vuelta a /dashboard, que vuelve a llamar esto y manda al
 * siguiente paso pendiente (o deja pasar, si ya no falta nada).
 *
 * "Hacerlo después" en hijos/invitar se recuerda con una cookie de SESIÓN
 * (sin maxAge — el navegador la borra sola al cerrarse del todo), no con una
 * columna en la base: esos dos pasos no son permanentemente opcionales,
 * vuelven a aparecer en una sesión nueva si siguen sin resolverse. Nombre,
 * modo de uso y WhatsApp no tienen "después" — si faltan, siempre redirigen,
 * igual que ya hacía antes el chequeo de usageMode en dashboard/page.tsx.
 */
export async function nextOnboardingStep(args: {
  profile: Parent | null;
  hasChildren: boolean;
  otherParent: Parent | null;
}): Promise<OnboardingStep | null> {
  const { profile, hasChildren, otherParent } = args;

  if (!profile?.onboardingNameConfirmedAt) return "nombre";
  if (!profile.usageMode) return "modo";

  const cookieStore = await cookies();
  const skipped = (cookieStore.get("onboarding_skip")?.value ?? "").split(",");

  if (!hasChildren && !skipped.includes("hijos")) return "hijos";
  if (profile.usageMode === "bilateral" && !otherParent && !skipped.includes("invitar")) return "invitar";
  if (profile.usageMode === "unilateral" && !profile.whatsappNumber) return "whatsapp";

  return null;
}

/** Usado por el botón "Hacerlo después" de hijos/invitar — ver nextOnboardingStep. */
export async function skipOnboardingStepForSession(step: "hijos" | "invitar"): Promise<void> {
  const cookieStore = await cookies();
  const current = (cookieStore.get("onboarding_skip")?.value ?? "").split(",").filter(Boolean);
  if (!current.includes(step)) current.push(step);
  cookieStore.set("onboarding_skip", current.join(","), { path: "/" });
}
