import { BarChart3, Download, Umbrella } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { FilterForm, FilterSubmit } from "@/components/form/filter-form";
import { PageHeader } from "@/components/page-header";
import { LeaveStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { formatRange } from "@/lib/format";
import { firstParam, monthTitle, parseMonthParam } from "@/lib/month-param";
import { monthOf, todayKey } from "@/lib/rules";
import { LEAVE_STATUS_META } from "@/lib/status";
import { LEAVE_STATUSES, attendanceReport, leaveReport, parseLeaveFilters } from "@/server/reports";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = firstParam(sp.tab) === "leave" ? "leave" : "attendance";
  const month = parseMonthParam(sp.month);
  const [departments, leaveTypes] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.leaveType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const deptParam = firstParam(sp.dept);
  const dept = departments.some((d) => d.id === deptParam) ? deptParam : undefined;
  const lf = parseLeaveFilters(sp);

  const [attendance, leave] = await Promise.all([attendanceReport(month, dept), leaveReport(lf)]);

  const attQuery = new URLSearchParams({ month, ...(dept ? { dept } : {}) });
  const leaveQuery = new URLSearchParams({
    from: lf.from,
    to: lf.to,
    ...(lf.status ? { status: lf.status } : {}),
    ...(lf.leaveTypeId ? { type: lf.leaveTypeId } : {}),
  });
  const totals = attendance.reduce(
    (t, r) => ({ present: t.present + r.present, late: t.late + r.late, absent: t.absent + r.absent, leave: t.leave + r.leave }),
    { present: 0, late: 0, absent: 0, leave: 0 },
  );

  return (
    <>
      <PageHeader title="Reports" description="Monthly attendance and leave, exportable to CSV." />
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Monthly attendance — {monthTitle(month)}</CardTitle>
              <CardDescription>
                Active employees only. Present {totals.present} · Late {totals.late} · Absent {totals.absent} · Leave {totals.leave}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterForm action="/reports" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="tab" value="attendance" />
                <div className="space-y-1.5">
                  <Label htmlFor="r-month">Month</Label>
                  <Input id="r-month" type="month" name="month" defaultValue={month} max={monthOf(todayKey())} className="w-44" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-dept">Department</Label>
                  <NativeSelect id="r-dept" name="dept" defaultValue={dept ?? ""} className="w-48">
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <FilterSubmit>Show</FilterSubmit>
                <Button asChild size="lg" className="ml-auto">
                  <a href={`/api/reports/attendance?${attQuery}`} download>
                    <Download /> Export CSV
                  </a>
                </Button>
              </FilterForm>
              {attendance.length === 0 ? (
                <EmptyState icon={BarChart3} title="No employees match" description="Try another department." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Working days</TableHead>
                      <TableHead className="text-right">Present</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">Half days</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                      <TableHead className="text-right">Missed check-outs</TableHead>
                      <TableHead className="text-right">Leave days</TableHead>
                      <TableHead className="text-right">Total hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((r) => (
                      <TableRow key={r.userId}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.department || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.workingDays}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.present}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.late}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.halfDay}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.absent}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.missedCheckout}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.leave}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.totalHours.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle>Leave requests</CardTitle>
              <CardDescription>All requests that overlap the selected dates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterForm action="/reports" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="tab" value="leave" />
                <div className="space-y-1.5">
                  <Label htmlFor="l-from">From</Label>
                  <Input id="l-from" type="date" name="from" defaultValue={lf.from} className="w-44" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-to">To</Label>
                  <Input id="l-to" type="date" name="to" defaultValue={lf.to} className="w-44" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-status">Status</Label>
                  <NativeSelect id="l-status" name="status" defaultValue={lf.status ?? ""} className="w-40">
                    <option value="">Any status</option>
                    {LEAVE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAVE_STATUS_META[s].label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-type">Type</Label>
                  <NativeSelect id="l-type" name="type" defaultValue={lf.leaveTypeId ?? ""} className="w-44">
                    <option value="">Any type</option>
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <FilterSubmit>Show</FilterSubmit>
                <Button asChild size="lg" className="ml-auto">
                  <a href={`/api/reports/leave?${leaveQuery}`} download>
                    <Download /> Export CSV
                  </a>
                </Button>
              </FilterForm>
              {leave.length === 0 ? (
                <EmptyState icon={Umbrella} title="No leave requests match" description="Try a wider date range or other filters." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decided by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leave.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell>{r.department || "—"}</TableCell>
                        <TableCell>{r.leaveTypeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatRange(r.start, r.end)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>{r.decidedByName ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
