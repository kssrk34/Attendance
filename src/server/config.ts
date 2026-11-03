import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  DEFAULT_SETTINGS,
  type DateKey,
  type WorkSettings,
  dbDateToKey,
  keyToDbDate,
  readableTextColor,
} from "@/lib/rules";

export const BRANDING_TAG = "branding";

export const getSettings = cache(async (): Promise<WorkSettings> => {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  if (!s) return DEFAULT_SETTINGS;
  return {
    workdayStart: s.workdayStart,
    lateGraceMinutes: s.lateGraceMinutes,
    halfDayMinHours: s.halfDayMinHours,
    fullDayMinHours: s.fullDayMinHours,
    workingDays: [...s.workingDays].sort(),
  };
});

export type HolidayRow = { id: string; date: DateKey; name: string };

/** Holidays between two dates (inclusive), sorted by date. */
export async function getHolidays(from: DateKey, to: DateKey): Promise<HolidayRow[]> {
  const rows = await db.holiday.findMany({
    where: { date: { gte: keyToDbDate(from), lte: keyToDbDate(to) } },
    orderBy: { date: "asc" },
  });
  return rows.map((h) => ({ id: h.id, date: dbDateToKey(h.date), name: h.name }));
}

export async function getHolidaySet(from: DateKey, to: DateKey): Promise<Set<DateKey>> {
  return new Set((await getHolidays(from, to)).map((h) => h.date));
}

export type Branding = {
  appName: string;
  companyName: string;
  logo: string | null;
  primaryColor: string;
  primaryForeground: string;
  /** Changes whenever branding is saved; used to bust favicon caches. */
  version: string;
};

const loadBranding = unstable_cache(
  async () => {
    const b = await db.branding.findUnique({ where: { id: 1 } });
    return {
      appName: b?.appName ?? DEFAULT_BRANDING.appName,
      companyName: b?.companyName ?? DEFAULT_BRANDING.companyName,
      logo: b?.logo ?? null,
      primaryColor: b?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
      version: b ? String(b.updatedAt.getTime()) : "0",
    };
  },
  ["branding-v1"],
  // Cleared instantly on save via the tag; the 60s expiry is a safety net for self-hosted
  // servers, where a tag invalidation doesn't survive a restart.
  { tags: [BRANDING_TAG], revalidate: 60 },
);

/** Branding is cached on the server; the cache is cleared whenever it's saved. */
export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const b = await loadBranding();
    return { ...b, primaryForeground: readableTextColor(b.primaryColor) };
  } catch (err) {
    // Fall back to generic branding (e.g. while the database is unreachable) so error pages still render.
    console.error("Failed to load branding", err);
    return {
      ...DEFAULT_BRANDING,
      primaryForeground: readableTextColor(DEFAULT_BRANDING.primaryColor),
      version: "0",
    };
  }
});
