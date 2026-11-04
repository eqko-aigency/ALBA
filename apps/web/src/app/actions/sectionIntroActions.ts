"use server";

import { getRequestContext } from "@/lib/repository";

export async function markSectionIntroSeenAction(sectionKey: string, as?: string) {
  const { pairing, parentId } = await getRequestContext(as);
  await pairing.markIntroSeen(parentId, sectionKey);
}
