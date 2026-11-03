"use client";

import { ChevronLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftMonth } from "@/lib/rules/time";
import { cn } from "@/lib/utils";

/** Arrow icon that turns into a spinner while the linked month loads. */
function ArrowIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" /> : <Icon />;
}

/** Month navigation that keeps other query params (e.g. department filters). */
export function MonthPicker({ month, maxMonth, minMonth }: { month: string; maxMonth: string; minMonth?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Show the picked month right away, while its page loads.
  const [shownMonth, setShownMonth] = useOptimistic(month);

  const hrefFor = (m: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("month", m);
    return `${pathname}?${p.toString()}`;
  };
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canPrev = !minMonth || prev >= minMonth;
  const canNext = next <= maxMonth;

  return (
    <div className="flex items-center gap-1" aria-busy={pending || undefined}>
      {canPrev ? (
        <Button asChild variant="outline" size="icon-lg" aria-label="Previous month">
          <Link href={hrefFor(prev)}>
            <ArrowIcon icon={ChevronLeft} />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon-lg" disabled aria-label="Previous month">
          <ChevronLeft />
        </Button>
      )}
      <Input
        type="month"
        aria-label="Month"
        className={cn("h-9 w-40 transition-opacity", pending && "opacity-60")}
        value={shownMonth}
        min={minMonth}
        max={maxMonth}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d{4}-\d{2}$/.test(v) || v > maxMonth) return;
          startTransition(() => {
            setShownMonth(v);
            router.push(hrefFor(v));
          });
        }}
      />
      {canNext ? (
        <Button asChild variant="outline" size="icon-lg" aria-label="Next month">
          <Link href={hrefFor(next)}>
            <ArrowIcon icon={ChevronRight} />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon-lg" disabled aria-label="Next month">
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}
