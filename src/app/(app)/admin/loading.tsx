import { PageSkeleton } from "@/components/page-skeleton";

// Shown instantly when moving between admin pages (Employees → Departments, …).
export default function Loading() {
  return <PageSkeleton />;
}
