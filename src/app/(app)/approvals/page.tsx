import { CheckCheck, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { BackInOffice } from "@/components/leave/back-in-office";
import { DecideButtons } from "@/components/leave/decide-buttons";
import { PageHeader } from "@/components/page-header";
import { LeaveStatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/db";
import { formatDateTime, formatRange } from "@/lib/format";
import { actionableWhere } from "@/server/approvals";
import { todayKey } from "@/lib/rules";
import { requestInclude, toRequestRow, withReturnDates } from "@/server/leave";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: PageProps<"/approvals">) {
  const user = await requireRole("MANAGER", "ADMIN");
  const tab = (await searchParams).tab === "decided" ? "decided" : "pending";
  const where = actionableWhere(user)!;

  const [pendingRaw, decidedRaw] = await Promise.all([
    db.leaveRequest.findMany({ where, include: requestInclude, orderBy: { startDate: "asc" } }),
    db.leaveRequest.findMany({
      where: { decidedById: user.id },
      include: requestInclude,
      orderBy: { decidedAt: "desc" },
      take: 50,
    }),
  ]);

  // Remaining balance (allocated − used) for each pending request's type and year.
  const balances = await db.leaveBalance.findMany({
    where: {
      OR: pendingRaw.map((r) => ({ userId: r.userId, leaveTypeId: r.leaveTypeId, year: r.startDate.getUTCFullYear() })),
    },
  });
  const remaining = (r: (typeof pendingRaw)[number]) => {
    const b = balances.find((x) => x.userId === r.userId && x.leaveTypeId === r.leaveTypeId && x.year === r.startDate.getUTCFullYear());
    return b ? { left: b.allocated - b.used, allocated: b.allocated } : null;
  };

  const pending = await withReturnDates(pendingRaw.map((r) => ({ ...toRequestRow(r), balance: remaining(r) })));
  const today = todayKey();
  const decided = decidedRaw.map(toRequestRow);

  return (
    <>
      <PageHeader
        title="Approvals"
        description={user.role === "ADMIN" ? "All pending leave requests in the company." : "Leave requests from your direct reports."}
      />
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="decided">Decided by me</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent>
              {pending.length === 0 ? (
                <EmptyState icon={CheckCheck} title="You're all caught up" description="There are no leave requests waiting for you." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Working days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Balance left</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((r) => (
                      <TableRow key={r.id} data-testid="approval-row">
                        <TableCell className="font-medium">
                          <Link href={`/team/${r.userId}`} className="link">
                            {r.userName}
                          </Link>
                        </TableCell>
                        <TableCell>{r.leaveTypeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatRange(r.start, r.end, { weekday: true })}
                          <BackInOffice back={r.back} today={today} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                        <TableCell className="max-w-xs text-sm whitespace-normal">{r.reason}</TableCell>
                        <TableCell className="tabular-nums">
                          {r.balance ? (
                            <span className={r.balance.left < r.days ? "font-medium text-destructive" : undefined}>
                              {r.balance.left} / {r.balance.allocated}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <DecideButtons id={r.id} employee={r.userName} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="decided">
          <Card>
            <CardContent>
              {decided.length === 0 ? (
                <EmptyState icon={History} title="Nothing decided yet" description="Requests you approve or reject will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Decided</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decided.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell>{r.leaveTypeCode}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatRange(r.start, r.end)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.days}</TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="max-w-xs text-sm whitespace-normal">{r.decisionNote ?? "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                          {r.decidedAt ? formatDateTime(r.decidedAt) : "—"}
                        </TableCell>
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
