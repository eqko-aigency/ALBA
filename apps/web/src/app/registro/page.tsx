import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/repository";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const { pairing, parentId } = await getRequestContext(as);
  const [profile, familyMembers] = await Promise.all([
    pairing.getProfile(parentId),
    pairing.listFamilyMembers(parentId),
  ]);
  const isPaired = familyMembers.some((m) => m.id !== parentId);
  const needsInvite = profile?.usageMode === "bilateral" && !isPaired;

  redirect(needsInvite ? `/onboarding/invitar${as ? `?as=${as}` : ""}` : isPaired ? "/perfil" : "/dashboard");
}
