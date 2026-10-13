import { AppNav } from "@/components/AppNav";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <>
      <PageSkeleton />
      <AppNav active="Bóveda" />
    </>
  );
}
