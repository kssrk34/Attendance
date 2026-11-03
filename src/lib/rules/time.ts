import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Company timezone. All "today" logic uses this, never the server's local time. */
export const TIMEZONE = "Asia/Kolkata";

/**
 * A calendar date in the company timezone, formatted as "YYYY-MM-DD".
 * Using plain strings keeps date-only values free of timezone surprises.
 */
export type DateKey = string;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's date in the company timezone. */
export function todayKey(now: Date = new Date()): DateKey {
  return formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
}

/** The company-timezone calendar date a timestamp falls on. */
export function dateKeyOf(instant: Date): DateKey {
  return formatInTimeZone(instant, TIMEZONE, "yyyy-MM-dd");
}

/** Convert a DB `@db.Date` value (UTC midnight) to a DateKey. */
export function dbDateToKey(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

/** Convert a DateKey to the value Prisma expects for a `@db.Date` column. */
export function keyToDbDate(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Day of week for a DateKey: 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: DateKey): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of DateKeys from start to end. Empty if start > end. */
export function eachDateKey(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

export function yearOf(key: DateKey): number {
  return Number(key.slice(0, 4));
}

/** "YYYY-MM" for a DateKey. */
export function monthOf(key: DateKey): string {
  return key.slice(0, 7);
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): boolean {
  return MONTH_RE.test(value);
}

/** First and last DateKey of a "YYYY-MM" month. */
export function monthRange(month: string): { start: DateKey; end: DateKey } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Parse "HH:mm" into minutes after midnight. */
export function parseTimeOfDay(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** The instant at which a company-timezone wall-clock time occurs on a given date. */
export function zonedInstant(key: DateKey, timeOfDay: string): Date {
  return fromZonedTime(`${key}T${timeOfDay}:00`, TIMEZONE);
}

/** Format an instant as a time in the company timezone, e.g. "09:42". */
export function formatTime(instant: Date): string {
  return formatInTimeZone(instant, TIMEZONE, "HH:mm");
}

/** Hours between two instants (fractional). */
export function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}

/** e.g. 7.5 -> "7h 30m" */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
