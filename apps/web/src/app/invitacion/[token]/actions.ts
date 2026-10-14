"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { acceptInvitationInputSchema } from "@alba/core";
import { getRequestContext } from "@/lib/repository";

export async function acceptInvitationAction(formData: FormData) {
  const input = acceptInvitationInputSchema.parse({ token: formData.get("token") });
  const { pairing, parentId } = await getRequestContext("b");

  try {
    await pairing.acceptInvitation(parentId, input);
  } catch (err) {
    // accept_invitation() (migración 0007) rechaza a propósito a quien ya
    // pertenece a una familia propia — pasa cuando alguien se registra
    // directo en vez de entrar por el link/código de invitación, porque
    // /registro ya le creó su propia familia en cuanto visitó esa pantalla.
    // Sin este catch, la excepción de Postgres llegaba cruda hasta acá y
    // tiraba a la pantalla genérica de error.tsx — un progenitor real vivió
    // justo esto sin ninguna pista de qué había pasado.
    const message = typeof err === "object" && err !== null && "message" in err ? String(err.message) : "";
    if (message.includes("ya perteneces a una familia")) {
      redirect(`/invitacion/${input.token}?error=ya_tiene_familia`);
    }
    throw err;
  }

  revalidatePath(`/invitacion/${input.token}`);
}
