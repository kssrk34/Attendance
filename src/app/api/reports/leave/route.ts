import type { NextRequest } from "next/server";
import { slugify } from "@/lib/rules";
import { getBranding } from "@/server/config";
import { leaveReport, parseLeaveFilters, toCsv } from "@/server/reports";
import { getCurrentUser } from "@/server/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const filters = parseLeaveFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const [rows, branding] = await Promise.all([leaveReport(filters), getBranding()]);

  const csv = toCsv(
    ["Employee", "Email", "Department", "Leave type", "Start", "End", "Days", "Status", "Reason", "Decided by", "Decision note", "Applied on"],
    rows.map((r) => [
      r.userName,
      r.email,
      r.department,
      r.leaveTypeName,
      r.start,
      r.end,
      r.days,
      r.status,
      r.reason,
      r.decidedByName ?? "",
      r.decisionNote ?? "",
      r.createdAt.toISOString().slice(0, 10),
    ]),
  );
  const filename = `${slugify(branding.companyName)}-leave-${filters.from}-to-${filters.to}.csv`;
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
