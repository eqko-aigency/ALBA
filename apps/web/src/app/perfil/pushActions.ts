"use server";

import { pushSubscriptionInputSchema } from "@alba/core";
import { getAuthedSupabaseClient } from "@/lib/repository";

export async function subscribePushAction(subscriptionJson: string): Promise<{ error?: string }> {
  let parsed;
  try {
    parsed = pushSubscriptionInputSchema.parse(JSON.parse(subscriptionJson));
  } catch {
    return { error: "Suscripción inválida." };
  }

  const { client, userId } = await getAuthedSupabaseClient();
  const { error } = await client.from("push_subscriptions").upsert(
    {
      parent_id: userId,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return { error: "No se pudo guardar la suscripción." };
  return {};
}

export async function unsubscribePushAction(endpoint: string): Promise<{ error?: string }> {
  const { client } = await getAuthedSupabaseClient();
  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: "No se pudo desactivar la suscripción." };
  return {};
}
