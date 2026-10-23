import { redirect } from "next/navigation";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  redirect(as ? `/onboarding/modo?as=${as}` : "/onboarding/modo");
}
