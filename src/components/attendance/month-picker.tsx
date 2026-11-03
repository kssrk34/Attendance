"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shiftMonth } from "@/lib/rules/time";

/** Month navigation that keeps other query params (e.g. department filters). */
export function MonthPicker({ month, maxMonth, minMonth }: { month: string; maxMonth: string; minMonth?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

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
    <div className="flex items-center gap-1">
      {canPrev ? (
        <Button asChild variant="outline" size="icon-lg" aria-label="Previous month">
          <Link href={hrefFor(prev)}>
            <ChevronLeft />
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
        className="h-9 w-40"
        value={month}
        min={minMonth}
        max={maxMonth}
        onChange={(e) => {
          const v = e.target.value;
          if (/^\d{4}-\d{2}$/.test(v) && v <= maxMonth) router.push(hrefFor(v));
        }}
      />
      {canNext ? (
        <Button asChild variant="outline" size="icon-lg" aria-label="Next month">
          <Link href={hrefFor(next)}>
            <ChevronRight />
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
