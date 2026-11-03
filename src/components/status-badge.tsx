import type { DayResult } from "@/lib/rules/attendance";
import type { LeaveStatus } from "@/lib/rules/leave";
import { DAY_META, LEAVE_STATUS_META, toneOf } from "@/lib/status";
import { cn } from "@/lib/utils";

const base = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap";

export function DayStatusBadge({ result, className }: { result: DayResult | null; className?: string }) {
  if (!result) {
    return <span className={cn(base, "bg-muted text-muted-foreground", className)}>Not checked in</span>;
  }
  const tone = toneOf(result);
  const late = result.late && tone !== "LATE";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn(base, DAY_META[tone].badge, className)} data-status={result.status}>
        {DAY_META[tone].label}
      </span>
      {late && <span className={cn(base, DAY_META.LATE.badge)}>Late</span>}
    </span>
  );
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span className={cn(base, LEAVE_STATUS_META[status].badge)} data-testid="leave-status">
      {LEAVE_STATUS_META[status].label}
    </span>
  );
}
