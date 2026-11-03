import { PageSkeleton } from "@/components/page-skeleton";

// Shown instantly when opening a team member (and going back to the list).
export default function Loading() {
  return <PageSkeleton />;
}
