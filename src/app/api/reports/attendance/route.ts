import type { NextRequest } from "next/server";
import { parseMonthParam } from "@/lib/month-param";
import { slugify } from "@/lib/rules";
import { getBranding } from "@/server/config";
import { attendanceReport, toCsv } from "@/server/reports";
import { getCurrentUser } from "@/server/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const month = parseMonthParam(req.nextUrl.searchParams.get("month") ?? undefined);
  const dept = req.nextUrl.searchParams.get("dept") || undefined;
  const [rows, branding] = await Promise.all([attendanceReport(month, dept), getBranding()]);

  const csv = toCsv(
    ["Employee", "Email", "Department", "Working days", "Present", "Late", "Half days", "Absent", "Missed check-outs", "Leave days", "Total hours"],
    rows.map((r) => [r.name, r.email, r.department, r.workingDays, r.present, r.late, r.halfDay, r.absent, r.missedCheckout, r.leave, r.totalHours.toFixed(2)]),
  );
  const filename = `${slugify(branding.companyName)}-attendance-${month}.csv`;
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
