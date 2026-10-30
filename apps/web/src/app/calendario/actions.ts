"use server";

import { revalidatePath } from "next/cache";
import {
  custodyEventInputSchema,
  custodySlotInputSchema,
  importantDateInputSchema,
  meetingPlaceInputSchema,
  visitInputSchema,
} from "@alba/core";
import { getRequestContext } from "@/lib/repository";
import { notifyFamilyMembers } from "@/lib/push";

export async function upsertSlotAction(formData: FormData) {
  const input = custodySlotInputSchema.parse({
    childId: formData.get("childId"),
    parentId: formData.get("parentId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    placeId: formData.get("placeId"),
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

export async function createMeetingPlaceAction(formData: FormData) {
  const input = meetingPlaceInputSchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    hotelCheckIn: formData.get("hotelCheckIn"),
    hotelCheckOut: formData.get("hotelCheckOut"),
    contacts: formData.get("contacts"),
    itinerary: formData.get("itinerary"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.createMeetingPlace(parentId, input);
  revalidatePath("/calendario");
}

export async function updateMeetingPlaceAction(formData: FormData) {
  const placeId = String(formData.get("placeId") ?? "");
  const input = meetingPlaceInputSchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    hotelCheckIn: formData.get("hotelCheckIn"),
    hotelCheckOut: formData.get("hotelCheckOut"),
    contacts: formData.get("contacts"),
    itinerary: formData.get("itinerary"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.updateMeetingPlace(parentId, placeId, input);
  revalidatePath("/calendario");
}

export async function deleteMeetingPlaceAction(formData: FormData) {
  const placeId = String(formData.get("placeId") ?? "");
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.deleteMeetingPlace(parentId, placeId);
  revalidatePath("/calendario");
}

export async function createVisitAction(formData: FormData) {
  const input = visitInputSchema.parse({
    childId: formData.get("childId"),
    parentId: formData.get("parentId"),
    title: formData.get("title"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    placeId: formData.get("placeId"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.createVisit(parentId, input);
  revalidatePath("/calendario");
}

export async function deleteVisitAction(formData: FormData) {
  const visitId = String(formData.get("visitId") ?? "");
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.deleteVisit(parentId, visitId);
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
  const { custody, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.confirmCheckin(parentId, input.childId, input.scheduledAt);
  revalidatePath("/calendario");

  const [family, children] = await Promise.all([pairing.getOrCreateMyFamily(parentId), pairing.getMyChildren(parentId)]);
  const childName = children.find((c) => c.id === input.childId)?.fullName ?? "tu hijo/a";
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Check-in confirmado",
    body: childName,
    url: "/calendario",
  });
}

export async function confirmCheckoutAction(formData: FormData) {
  const input = custodyEventInputSchema.parse({
    childId: formData.get("childId"),
    type: "checkout",
    scheduledAt: formData.get("scheduledAt"),
    location: null,
  });
  const { custody, pairing, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.confirmCheckout(parentId, input.childId, input.scheduledAt);
  revalidatePath("/calendario");

  const [family, children] = await Promise.all([pairing.getOrCreateMyFamily(parentId), pairing.getMyChildren(parentId)]);
  const childName = children.find((c) => c.id === input.childId)?.fullName ?? "tu hijo/a";
  await notifyFamilyMembers({
    familyId: family.id,
    excludeParentId: parentId,
    title: "Check-out confirmado",
    body: childName,
    url: "/calendario",
  });
}

export async function createImportantDateAction(formData: FormData) {
  const input = importantDateInputSchema.parse({
    title: formData.get("title"),
    childId: formData.get("childId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.createImportantDate(parentId, input);
  revalidatePath("/calendario");
}

export async function deleteImportantDateAction(formData: FormData) {
  const importantDateId = String(formData.get("importantDateId") ?? "");
  const { custody, parentId } = await getRequestContext(String(formData.get("as") ?? ""));
  await custody.deleteImportantDate(parentId, importantDateId);
  revalidatePath("/calendario");
}
