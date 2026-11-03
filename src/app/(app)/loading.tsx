import { PageSkeleton } from "@/components/page-skeleton";

// Shown instantly when moving between sections (Dashboard, Leave, Team, …) while the page loads.
// Filters inside a page (month, search, department) keep the current page on screen instead.
export default function Loading() {
  return <PageSkeleton />;
}
