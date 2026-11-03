import { isMonthKey, monthOf, todayKey } from "./rules/time";

/** Read a "YYYY-MM" query param, falling back to the current month; never later than this month. */
export function parseMonthParam(value: string | string[] | undefined): string {
  const current = monthOf(todayKey());
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !isMonthKey(v) || v > current) return current;
  return v;
}

export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
