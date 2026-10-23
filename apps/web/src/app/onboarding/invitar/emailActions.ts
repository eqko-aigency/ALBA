"use server";

import { redirect } from "next/navigation";
import { sendInvitationEmailInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

const isResendConfigured = Boolean(process.env.RESEND_API_KEY);

const INVITATION_EMAIL_HOURLY_LIMIT = 5;
const INVITATION_EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type RateLimitEntry = { count: number; windowStart: number };

// Map global en vez de uno por closure/módulo porque Next.js recarga este
// módulo en cada hot-reload en dev — mismo criterio que globalForMock en
// repository.ts para sobrevivir eso. No sobrevive un restart del proceso ni
// escala a más de una instancia; aceptable para el cohort Beta de confianza
// (gap aceptado explícitamente en la revisión de seguridad), bloqueante
// antes de abrir signup público/self-serve.
const globalForInvitationRateLimit = globalThis as unknown as {
  invitationEmailRateLimit?: Map<string, RateLimitEntry>;
};
globalForInvitationRateLimit.invitationEmailRateLimit ??= new Map();
const invitationEmailRateLimit = globalForInvitationRateLimit.invitationEmailRateLimit;

/**
 * Cap minimalista contra abuso de la identidad de envío de ALBA
 * (invitaciones@alba.app): sin esto, cualquier usuario autenticado podía
 * resubmitir este form con un email de destino distinto en cada request,
 * sin límite, y usar a ALBA para mandar spam a terceros. Ventana fija (no
 * sliding window) por parentId — alcanza para frenar un loop/script; no
 * pretende ser precisa al segundo.
 */
function consumeInvitationEmailRateLimit(parentId: string): boolean {
  const now = Date.now();
  const entry = invitationEmailRateLimit.get(parentId);
  if (!entry || now - entry.windowStart >= INVITATION_EMAIL_RATE_LIMIT_WINDOW_MS) {
    invitationEmailRateLimit.set(parentId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= INVITATION_EMAIL_HOURLY_LIMIT) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * `fullName` solo tiene restricción de largo (2-120), no de caracteres —
 * en todo el resto de la app llega a pantalla vía React (que escapa solo),
 * pero acá se inyecta directo en el HTML crudo que Resend manda a un
 * tercero. Sin esto, un nombre con markup/links saldría del dominio de
 * ALBA como si la propia app lo hubiera escrito.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Llama directo al API HTTP de Resend (sin el SDK `resend` como dependencia
 * nueva — un solo fetch alcanza) porque el envío de correos de Supabase Auth
 * (usado para confirmar cuenta) solo manda SUS propios correos, no uno
 * personalizado a cualquier dirección. No se guarda ningún registro de "se
 * mandó este correo" — es solo una forma más de entregar el mismo
 * link/código que ya existe; el estado de la invitación (pendiente/
 * aceptada) no cambia por este canal.
 *
 * Sin RESEND_API_KEY configurada (dev local), no falla — responde como si
 * hubiera mandado, mismo criterio que isSupabaseConfigured en otras partes
 * del proyecto. Bloqueante para producción: necesita la key real.
 */
export async function sendInvitationEmailAction(formData: FormData) {
  const as = String(formData.get("as") ?? "");
  const parsed = sendInvitationEmailInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(buildRedirect(as, { emailError: "Escribe un correo válido." }));
  }

  const { pairing, parentId } = await getRequestContext(as);
  await pairing.getOrCreateMyFamily(parentId);
  const profile = await pairing.getProfile(parentId);

  let activeInvitations = (await pairing.listPendingInvitations(parentId)).filter(
    (inv) => new Date(inv.expiresAt) > new Date()
  );
  if (activeInvitations.length === 0) {
    activeInvitations = [await pairing.createInvitation(parentId)];
  }
  const invitation = activeInvitations[0]!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const invitationUrl = `${siteUrl}/invitacion/${invitation.token}`;

  if (isResendConfigured) {
    if (!consumeInvitationEmailRateLimit(parentId)) {
      redirect(
        buildRedirect(as, {
          emailError: "Mandaste muchas invitaciones por correo en poco tiempo. Espera un poco o comparte el link directo.",
        })
      );
    }

    const safeName = escapeHtml(profile?.fullName ?? "Alguien");
    // El fetch (no el redirect() de más abajo) va envuelto en try/catch:
    // redirect() funciona lanzando una excepción interna que Next.js
    // reconoce más arriba en la pila — si quedara dentro de este catch,
    // correría el riesgo de que ese mecanismo se trague por error. Un
    // fallo de red (DNS, timeout, conexión reseteada) deja response en
    // null en vez de propagarse como excepción no manejada.
    let response: Response | null = null;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ALBA <invitaciones@alba.app>",
          to: [parsed.data!.email],
          subject: `${safeName} te invitó a coordinarse en ALBA`,
          html: `<p>${safeName} te invitó a coparentar juntos en ALBA.</p><p><a href="${invitationUrl}">Aceptar invitación</a></p>`,
        }),
      });
    } catch {
      response = null;
    }
    if (!response || !response.ok) {
      redirect(buildRedirect(as, { emailError: "No se pudo mandar el correo. Intenta de nuevo o comparte el link directo." }));
    }
  }

  redirect(buildRedirect(as, { emailSent: "1" }));
}

function buildRedirect(as: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  if (as) search.set("as", as);
  return `/onboarding/invitar?${search.toString()}`;
}
