"use server";

import { revalidatePath } from "next/cache";
import { custodyEventInputSchema, custodySlotInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function upsertSlotAction(formData: FormData) {
  const input = custodySlotInputSchema.parse({
    childId: formData.get("childId"),
    parentId: formData.get("parentId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));

  const agreement = await custody.getMyAgreement(parentId);
  await custody.upsertSlots(parentId, [...agreement.slots, input]);

  revalidatePath("/calendario");
}

export async function removeSlotAction(formData: FormData) {
  // Los slots no tienen id propio en el dominio (CustodySlot en
  // entities.ts) — se identifican por posición dentro del arreglo ya
  // ordenado que devuelve getMyAgreement/upsertSlots (weekday, startTime),
  // el mismo orden que la UI usó para renderizar el botón "Quitar".
  const slotIndex = Number(formData.get("slotIndex") ?? -1);
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));

  const agreement = await custody.getMyAgreement(parentId);
  const nextSlots = agreement.slots.filter((_, idx) => idx !== slotIndex);
  await custody.upsertSlots(parentId, nextSlots);

  revalidatePath("/calendario");
}

export async function confirmCheckinAction(formData: FormData) {
  // location: null — el MVP no captura geolocalización en la UI todavía;
  // la columna/tipo ya lo soportan para cuando se agregue.
  const input = custodyEventInputSchema.parse({
    childId: formData.get("childId"),
    type: "checkin",
    scheduledAt: formData.get("scheduledAt"),
    location: null,
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.confirmCheckin(parentId, input.childId, input.scheduledAt);
  revalidatePath("/calendario");
}

export async function confirmCheckoutAction(formData: FormData) {
  const input = custodyEventInputSchema.parse({
    childId: formData.get("childId"),
    type: "checkout",
    scheduledAt: formData.get("scheduledAt"),
    location: null,
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.confirmCheckout(parentId, input.childId, input.scheduledAt);
  revalidatePath("/calendario");
}
