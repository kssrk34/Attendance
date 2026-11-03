"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { DayStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TIMEZONE, formatHours, hoursBetween } from "@/lib/rules/time";
import type { AttendanceLike, DayResult } from "@/lib/rules/attendance";
import { checkInAction, checkOutAction } from "@/server/attendance-actions";

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Render the clock only on the client to avoid a server/client time mismatch.
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-live="off" data-testid="live-clock">
      {now ? formatInTimeZone(now, TIMEZONE, "HH:mm:ss") : "--:--:--"}
      <span className="ml-2 align-middle font-sans text-sm font-medium text-muted-foreground">IST</span>
    </p>
  );
}

function fmt(d: Date | null | undefined) {
  return d ? formatInTimeZone(d, TIMEZONE, "hh:mm a") : "—";
}

export function CheckInCard({
  dateLabel,
  record,
  result,
  blockedReason,
}: {
  dateLabel: string;
  record: AttendanceLike | null;
  result: DayResult | null;
  blockedReason: string | null;
}) {
  const [pending, startTransition] = useTransition();

  const run = (action: typeof checkInAction) =>
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  const canCheckIn = !record && !blockedReason;
  const canCheckOut = !!record && !record.checkOutAt;
  const hours = record?.checkOutAt ? hoursBetween(record.checkInAt, record.checkOutAt) : null;

  return (
    <Card data-testid="check-in-card">
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>{dateLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3">
          <LiveClock />
          <div data-testid="today-status">
            {result ? (
              <DayStatusBadge result={result} />
            ) : blockedReason ? (
              <span className="text-sm text-muted-foreground">{blockedReason}</span>
            ) : (
              <DayStatusBadge result={null} />
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/60 p-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Check in</dt>
            <dd className="text-sm font-semibold tabular-nums" data-testid="check-in-time">
              {fmt(record?.checkInAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Check out</dt>
            <dd className="text-sm font-semibold tabular-nums" data-testid="check-out-time">
              {fmt(record?.checkOutAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Worked</dt>
            <dd className="text-sm font-semibold tabular-nums">{hours !== null ? formatHours(hours) : "—"}</dd>
          </div>
        </dl>

        {canCheckIn && (
          <Button size="lg" className="h-14 w-full text-base" onClick={() => run(checkInAction)} disabled={pending}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
            Check In
          </Button>
        )}
        {canCheckOut && (
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-full border-primary text-base text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => run(checkOutAction)}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
            Check Out
          </Button>
        )}
        {record?.checkOutAt && (
          <p className="text-center text-sm text-muted-foreground">You&apos;re done for today. See you tomorrow!</p>
        )}
      </CardContent>
    </Card>
  );
}
