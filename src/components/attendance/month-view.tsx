import { formatInTimeZone } from "date-fns-tz";
import { CalendarX2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { DayStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarize } from "@/lib/rules/attendance";
import { TIMEZONE, formatHours, todayKey, weekdayOf } from "@/lib/rules/time";
import { DAY_META, type DayTone, toneOf } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { DayRow } from "@/server/attendance";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEGEND: DayTone[] = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "MISSED_CHECKOUT", "CHECKED_IN", "HOLIDAY", "WEEKEND"];

function dayLabel(key: string) {
  return formatInTimeZone(new Date(`${key}T12:00:00Z`), "UTC", "EEE, dd MMM");
}
function time(d: Date | null | undefined) {
  return d ? formatInTimeZone(d, TIMEZONE, "hh:mm a") : "—";
}

export function MonthSummary({ days, compact = false }: { days: DayRow[]; compact?: boolean }) {
  const s = summarize(days.map((d) => d.result));
  const items = [
    { label: "Present", value: s.present, tone: "PRESENT" as DayTone },
    { label: "Late", value: s.late, tone: "LATE" as DayTone },
    { label: "Half days", value: s.halfDay, tone: "HALF_DAY" as DayTone },
    { label: "Absent", value: s.absent, tone: "ABSENT" as DayTone },
    { label: "Missed check-out", value: s.missedCheckout, tone: "MISSED_CHECKOUT" as DayTone },
    { label: "Leave days", value: s.leave, tone: "ON_LEAVE" as DayTone },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", !compact && "lg:grid-cols-6")}>
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", DAY_META[i.tone].dot)} aria-hidden />
            {i.label}
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{i.value}</p>
        </div>
      ))}
    </div>
  );
}

export function MonthCalendar({ days }: { days: DayRow[] }) {
  const today = todayKey();
  // Monday-first grid
  const lead = (weekdayOf(days[0].date) + 6) % 7;
  const cells: (DayRow | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Attendance calendar">
        {cells.map((c, i) => {
          if (!c) return <div key={i} aria-hidden />;
          const tone = c.result ? toneOf(c.result) : null;
          const label = tone ? DAY_META[tone].label : c.date > today ? "Upcoming" : "No status";
          return (
            <div
              key={c.date}
              role="gridcell"
              title={`${dayLabel(c.date)}: ${c.holidayName ?? label}`}
              aria-label={`${dayLabel(c.date)}: ${c.holidayName ?? label}`}
              className={cn(
                "flex aspect-square min-h-10 flex-col justify-between rounded-md border p-1 text-left sm:aspect-auto sm:h-16 sm:p-1.5",
                tone ? DAY_META[tone].cell : "border-dashed bg-background text-muted-foreground",
                c.date === today && "ring-2 ring-primary ring-offset-1",
              )}
              data-status={c.result?.status ?? "NONE"}
            >
              <span className="text-xs font-semibold tabular-nums sm:text-sm">{Number(c.date.slice(8))}</span>
              <span className="hidden truncate text-[10px] leading-tight sm:block">{c.holidayName ?? (tone ? label : "")}</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
        {LEGEND.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", DAY_META[t].dot)} aria-hidden />
            {DAY_META[t].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MonthTable({ days, fullDayMinHours }: { days: DayRow[]; fullDayMinHours: number }) {
  const rows = days.filter((d) => d.result || d.record).reverse();
  if (rows.length === 0) {
    return <EmptyState icon={CalendarX2} title="No attendance for this month" description="Days appear here once they have a status." />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Check in</TableHead>
          <TableHead>Check out</TableHead>
          <TableHead className="text-right">Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => (
          <TableRow key={d.date}>
            <TableCell className="font-medium whitespace-nowrap">
              {dayLabel(d.date)}
              {d.holidayName && <span className="block text-xs font-normal text-muted-foreground">{d.holidayName}</span>}
            </TableCell>
            <TableCell>
              <DayStatusBadge result={d.result} />
            </TableCell>
            <TableCell className="tabular-nums">{time(d.record?.checkInAt)}</TableCell>
            <TableCell className="tabular-nums">{time(d.record?.checkOutAt)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {d.hours !== null ? (
                <span className={cn(d.hours < fullDayMinHours && "text-amber-700")}>
                  {formatHours(d.hours)}
                  {d.hours < fullDayMinHours && <span className="sr-only"> (below a full day)</span>}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AttendanceMonth({ days, fullDayMinHours }: { days: DayRow[]; fullDayMinHours: number }) {
  return (
    <div className="space-y-6">
      <MonthSummary days={days} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthCalendar days={days} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Daily log</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthTable days={days} fullDayMinHours={fullDayMinHours} />
            <p className="mt-3 text-xs text-muted-foreground">
              Hours in amber are below a full day ({fullDayMinHours}h).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
