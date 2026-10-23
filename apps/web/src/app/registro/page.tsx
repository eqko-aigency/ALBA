import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const familyMembers = await pairing.listFamilyMembers(parentId);
  const isPaired = familyMembers.some((m) => m.id !== parentId);

  redirect(isPaired ? "/perfil" : `/onboarding/invitar${as ? `?as=${as}` : ""}`);
}
