import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const isPushConfigured = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY
);

// web-push exige que el "subject" sea https: o mailto: — nunca http:, así
// que NEXT_PUBLIC_SITE_URL solo (http://localhost:3000 en dev local)
// revienta setVapidDetails() y con eso CUALQUIER build que toque este
// módulo. El subject es solo un contacto para el servicio de push en caso
// de abuso, no necesita ser el dominio real del sitio.
const vapidSubject =
  process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ? process.env.NEXT_PUBLIC_SITE_URL : "mailto:soporte@eqko.tech";

if (isPushConfigured) {
  webpush.setVapidDetails(vapidSubject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

/**
 * Cliente de Supabase con el service_role key — ignora RLS por completo.
 * Nunca se importa desde un componente cliente ni se expone al navegador
 * (la key no lleva prefijo NEXT_PUBLIC_ a propósito). Es la única forma
 * de leer la suscripción de push de OTRO progenitor para poder avisarle
 * algo — ninguna policy de RLS razonable debería permitir eso desde el
 * cliente (ver 0019_push_subscriptions.sql).
 */
function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Manda un push a todos los dispositivos de los miembros de la familia
 * EXCEPTO excludeParentId (quien disparó la acción nunca se notifica a sí
 * mismo). Se llama desde dentro de un Server Action, DESPUÉS de que la
 * mutación principal ya se guardó — nunca bloquea ni revienta la acción:
 * cualquier error acá se loguea y se ignora, un push fallido no debe
 * tumbar un "registrar gasto" o "enviar mensaje".
 *
 * Suscripciones que el navegador del otro lado ya invalidó (404/410 —
 * desinstaló la app, borró datos del sitio, etc.) se borran solas de la
 * tabla en vez de seguir intentando mandarles algo para siempre.
 */
export async function notifyFamilyMembers(params: {
  familyId: string;
  excludeParentId: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  if (!isPushConfigured) return;

  try {
    const client = getServiceClient();

    const { data: members, error: membersError } = await client
      .from("family_members")
      .select("parent_id")
      .eq("family_id", params.familyId);
    if (membersError) throw membersError;

    const recipientIds = (members ?? []).map((m: any) => m.parent_id).filter((id: string) => id !== params.excludeParentId);
    if (recipientIds.length === 0) return;

    const { data: subscriptions, error: subsError } = await client
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("parent_id", recipientIds);
    if (subsError) throw subsError;
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({ title: params.title, body: params.body, url: params.url });

    await Promise.all(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await client.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("[push] falló el envío a una suscripción", { id: sub.id, err });
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] notifyFamilyMembers falló", err);
  }
}
