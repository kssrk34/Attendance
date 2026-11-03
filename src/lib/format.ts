import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "./rules/time";

/** "03 Nov 2026" for a DateKey. */
export function formatDateKey(key: string, pattern = "dd MMM yyyy"): string {
  return formatInTimeZone(new Date(`${key}T12:00:00Z`), "UTC", pattern);
}

/** "03 Nov – 05 Nov 2026", or a single date. */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDateKey(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDateKey(start, "dd MMM")} – ${formatDateKey(end)}`;
  return `${formatDateKey(start)} – ${formatDateKey(end)}`;
}

/** Timestamp in the company timezone, e.g. "03 Nov 2026, 09:41". */
export function formatDateTime(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, "dd MMM yyyy, HH:mm");
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
