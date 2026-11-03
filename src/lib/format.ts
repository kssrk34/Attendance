import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "./rules/time";

/** "03 Nov 2026" for a DateKey. */
export function formatDateKey(key: string, pattern = "dd MMM yyyy"): string {
  return formatInTimeZone(new Date(`${key}T12:00:00Z`), "UTC", pattern);
}

/**
 * "03 Nov – 05 Nov 2026", or a single date.
 * With `weekday`: "Tue, 03 Nov – Thu, 05 Nov 2026", so it's clear when a range spans a weekend.
 */
export function formatRange(start: string, end: string, { weekday = false } = {}): string {
  const w = weekday ? "EEE, " : "";
  if (start === end) return formatDateKey(start, `${w}dd MMM yyyy`);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDateKey(start, `${w}dd MMM`)} – ${formatDateKey(end, `${w}dd MMM yyyy`)}`;
  return `${formatDateKey(start, `${w}dd MMM yyyy`)} – ${formatDateKey(end, `${w}dd MMM yyyy`)}`;
}

/** "Tue, 10 Nov", plus the year when it isn't the same as `today`'s. */
export function formatShortDay(key: string, today: string): string {
  return formatDateKey(key, key.slice(0, 4) === today.slice(0, 4) ? "EEE, dd MMM" : "EEE, dd MMM yyyy");
}

/** Timestamp in the company timezone, e.g. "03 Nov 2026, 09:41". */
export function formatDateTime(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, "dd MMM yyyy, HH:mm");
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
