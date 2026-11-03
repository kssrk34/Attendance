import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MonthPicker } from "@/components/attendance/month-picker";
import { AttendanceMonth } from "@/components/attendance/month-view";
import { BalanceCards } from "@/components/leave/balance-cards";
import { RequestList } from "@/components/leave/request-list";
import { PageHeader } from "@/components/page-header";
import { roleLabel } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDateKey } from "@/lib/format";
import { monthTitle, parseMonthParam } from "@/lib/month-param";
import { dbDateToKey, monthOf, monthRange, todayKey, yearOf } from "@/lib/rules";
import { getUserDays } from "@/server/attendance";
import { getSettings } from "@/server/config";
import { getBalances, getUserRequests } from "@/server/leave";
import { canViewUser, requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Team member" };

export default async function TeamMemberPage({ params, searchParams }: PageProps<"/team/[userId]">) {
  const viewer = await requireRole("MANAGER", "ADMIN");
  const { userId } = await params;
  if (!(await canViewUser(viewer, userId))) redirect("/forbidden");

  const member = await db.user.findUnique({
    where: { id: userId },
    include: { department: true, manager: { select: { name: true } } },
  });
  if (!member) notFound();

  const month = parseMonthParam((await searchParams).month);
  const { start, end } = monthRange(month);
  const [days, settings, requests, balances] = await Promise.all([
    getUserDays(member, start, end),
    getSettings(),
    getUserRequests(member.id),
    getBalances(member.id, yearOf(todayKey())),
  ]);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/team">
          <ArrowLeft /> Team
        </Link>
      </Button>
      <PageHeader
        title={member.name}
        description={
          <>
            {roleLabel(member.role)} · {member.department?.name ?? "No department"}
            {member.manager ? ` · Reports to ${member.manager.name}` : ""} · Joined {formatDateKey(dbDateToKey(member.joinDate))}
            {!member.isActive && " · Deactivated"}
          </>
        }
        actions={<MonthPicker month={month} maxMonth={monthOf(todayKey())} minMonth={monthOf(dbDateToKey(member.joinDate))} />}
      />
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">{monthTitle(month)}</h2>
        <AttendanceMonth days={days} fullDayMinHours={settings.fullDayMinHours} />
        <Card>
          <CardHeader>
            <CardTitle>Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <BalanceCards balances={balances} />
            <RequestList requests={requests} allowCancel={false} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
