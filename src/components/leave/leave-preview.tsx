import { BriefcaseBusiness, CircleAlert } from "lucide-react";
import { formatDateKey } from "@/lib/format";
import type { HolidaySet } from "@/lib/rules/calendar";
import {
  type LeaveDayKind,
  type LeaveStatus,
  type LeaveValidationResult,
  type Range,
  leaveDayBreakdown,
  leaveDayKind,
  returnToOffice,
} from "@/lib/rules/leave";
import { addDaysKey, eachDateKey } from "@/lib/rules/time";
import { DAY_META } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Longest range shown day by day. A valid request is far shorter than this. */
const MAX_DAYS_SHOWN = 31;
/** Longest stretch of days off shown between the end of the leave and the day back. */
const MAX_GAP_SHOWN = 6;

type Props = {
  start: string;
  end: string;
  today: string;
  result: LeaveValidationResult;
  /** allocated − used − pending for the chosen type and year. */
  available: number;
  leaveTypeName: string;
  workingDays: number[];
  holidays: HolidaySet;
  holidayNames: ReadonlyMap<string, string>;
  /** The user's other PENDING and APPROVED requests. */
  existing: (Range & { status: LeaveStatus })[];
};

/**
 * What the chosen dates mean, before submitting: how many working days come off the balance,
 * which days are free (weekends, holidays), and the day the person is back in office.
 */
export function LeavePreview(props: Props) {
  const { start, end, today, result, available, leaveTypeName, workingDays, holidays, holidayNames, existing } = props;
  const settings = { workingDays };
  const days = start <= end ? leaveDayBreakdown(start, end, settings, holidays) : [];
  const showDays = days.length > 0 && days.length <= MAX_DAYS_SHOWN;
  const back = result.ok ? returnToOffice(end, settings, holidays, existing) : null;

  return (
    <div className="space-y-3">
      {result.ok ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p>
            <span className="text-lg font-semibold" data-testid="leave-preview-days">
              {result.days} working day{result.days === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-muted-foreground">of {leaveTypeName}</span>
          </p>
          <p className="text-muted-foreground">
            {Math.max(0, available)} available →{" "}
            <span className="font-semibold text-foreground">{available - result.days} left after this</span>
          </p>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {result.error}
        </p>
      )}

      {back && <BackBanner back={back.date} today={today} afterOtherLeave={back.afterOtherLeave} />}

      {/* A visual aid only: the text above and below says the same, and this would be noisy in the live region. */}
      {showDays && (
        <div aria-hidden>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Day by day</p>
          <ol className="flex flex-wrap gap-1.5" data-testid="leave-preview-calendar">
            {days.map((d) => (
              <DayChip key={d.date} date={d.date} kind={d.kind} holidayName={holidayNames.get(d.date)} />
            ))}
            {back && <GapAndBack end={end} back={back.date} {...{ workingDays, holidays, holidayNames }} />}
          </ol>
        </div>
      )}

      {result.ok && <NotCountedNote days={days} />}
    </div>
  );
}

function BackBanner({ back, today, afterOtherLeave }: { back: string; today: string; afterOtherLeave: boolean }) {
  const lead = back > today ? "You'll be back in office on" : back === today ? "You're back in office today," : "You were back in office on";
  return (
    <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900" data-testid="leave-preview-back">
      <BriefcaseBusiness className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
      <div>
        <p className="text-xs text-emerald-800">{lead}</p>
        <p className="font-semibold">{formatDateKey(back, "EEEE, dd MMM yyyy")}</p>
        {afterOtherLeave && <p className="mt-0.5 text-xs text-emerald-800">Your other leave right after this one is included.</p>}
      </div>
    </div>
  );
}

type ChipKind = LeaveDayKind | "OTHER_LEAVE" | "BACK";

const CHIP: Record<ChipKind, { label: string; className: string }> = {
  WORKING: { label: "Leave", className: DAY_META.ON_LEAVE.cell },
  WEEKEND: { label: "Weekend", className: DAY_META.WEEKEND.cell },
  HOLIDAY: { label: "Holiday", className: DAY_META.HOLIDAY.cell },
  OTHER_LEAVE: { label: "Leave", className: "border-dashed border-blue-300 bg-blue-50 text-blue-900" },
  BACK: { label: "Back", className: "border-emerald-300 bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300" },
};

function DayChip({ date, kind, holidayName, outside }: { date: string; kind: ChipKind; holidayName?: string; outside?: boolean }) {
  const meta = CHIP[kind];
  const label = kind === "HOLIDAY" && holidayName ? holidayName : meta.label;
  const title = [formatDateKey(date, "EEEE, dd MMM yyyy"), kind === "BACK" ? "back in office" : label, kind === "WORKING" ? "counted" : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      className={cn(
        "flex w-[3.75rem] flex-col items-center rounded-md border px-1 py-1 text-center leading-tight",
        meta.className,
        outside && kind !== "BACK" && "border-dashed opacity-70",
      )}
      title={title}
      data-kind={kind}
    >
      <span className="text-[11px] uppercase">{formatDateKey(date, "EEE")}</span>
      <span className="text-xs font-semibold tabular-nums">{formatDateKey(date, "d MMM")}</span>
      <span className="w-full truncate text-[11px]">{label}</span>
    </li>
  );
}

/** Days off between the end of the leave and the day back (e.g. a weekend), then the day back. */
function GapAndBack({
  end,
  back,
  workingDays,
  holidays,
  holidayNames,
}: {
  end: string;
  back: string;
  workingDays: number[];
  holidays: HolidaySet;
  holidayNames: ReadonlyMap<string, string>;
}) {
  const gap = eachDateKey(addDaysKey(end, 1), addDaysKey(back, -1));
  const settings = { workingDays };
  return (
    <>
      {gap.length <= MAX_GAP_SHOWN ? (
        gap.map((date) => {
          const kind = leaveDayKind(date, settings, holidays);
          // A working day between the leave and the day back can only be the person's other leave.
          return <DayChip key={date} date={date} kind={kind === "WORKING" ? "OTHER_LEAVE" : kind} holidayName={holidayNames.get(date)} outside />;
        })
      ) : (
        <li className="flex w-[3.75rem] flex-col items-center justify-center rounded-md border border-dashed px-1 py-1 text-center text-[11px] leading-tight text-muted-foreground">
          <span className="font-semibold">+{gap.length}</span>
          <span>days off</span>
        </li>
      )}
      <DayChip date={back} kind="BACK" />
    </>
  );
}

/** "5 days picked: 3 working days counted. Not counted: 2 weekend days." */
function NotCountedNote({ days }: { days: { kind: LeaveDayKind }[] }) {
  const weekend = days.filter((d) => d.kind === "WEEKEND").length;
  const holiday = days.filter((d) => d.kind === "HOLIDAY").length;
  if (weekend === 0 && holiday === 0) return null;
  const working = days.length - weekend - holiday;
  const free = [
    weekend > 0 && `${weekend} weekend day${weekend === 1 ? "" : "s"}`,
    holiday > 0 && `${holiday} holiday${holiday === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return (
    <p className="text-xs text-muted-foreground" data-testid="leave-preview-note">
      You picked {days.length} days. Only the {working} working day{working === 1 ? "" : "s"} {working === 1 ? "is" : "are"} taken from your
      balance; the {free.join(" and ")} {weekend + holiday === 1 ? "isn't" : "aren't"} counted.
    </p>
  );
}
