import { BriefcaseBusiness } from "lucide-react";
import { formatShortDay } from "@/lib/format";
import type { ReturnToOffice } from "@/lib/rules/leave";
import { cn } from "@/lib/utils";

/** Short "Back in office" line shown under a leave's dates. Renders nothing when there's no date. */
export function BackInOffice({ back, today, className }: { back: ReturnToOffice | null; today: string; className?: string }) {
  if (!back) return null;
  const when = back.date === today ? "today" : formatShortDay(back.date, today);
  const label = back.date < today ? "Returned to office" : "Back in office";
  return (
    <p className={cn("mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground", className)} data-testid="back-in-office">
      <BriefcaseBusiness className="size-3 shrink-0" aria-hidden />
      <span>
        {label} <span className="font-medium text-emerald-700">{when}</span>
        {back.afterOtherLeave && " (after the next leave)"}
      </span>
    </p>
  );
}
