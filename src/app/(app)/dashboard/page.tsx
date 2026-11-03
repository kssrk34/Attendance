import { ArrowRight, CalendarDays, CheckSquare, Clock, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckInCard } from "@/components/attendance/check-in-card";
import { MonthSummary } from "@/components/attendance/month-view";
import { EmptyState } from "@/components/empty-state";
import { BackInOffice } from "@/components/leave/back-in-office";
import { BalanceCards } from "@/components/leave/balance-cards";
import { PageHeader } from "@/components/page-header";
import { LeaveStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatDateKey, formatRange } from "@/lib/format";
import { monthOf, monthRange, todayKey, yearOf } from "@/lib/rules";
import { DAY_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { countPendingApprovals } from "@/server/approvals";
import { getTodayState, getUserDays } from "@/server/attendance";
import { getHolidays } from "@/server/config";
import { getBalances, requestInclude, toRequestRow, withReturnDates } from "@/server/leave";
import { requireUser } from "@/server/session";
import { type TeamMember, countToday, getTeam } from "@/server/team";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayKey();
  const year = yearOf(today);
  const { start } = monthRange(monthOf(today));

  const [todayState, monthDays, balances, holidays, myPending, approvals, team] = await Promise.all([
    getTodayState(user),
    getUserDays(user, start, today),
    getBalances(user.id, year),
    getHolidays(today, `${year + 1}-12-31`),
    db.leaveRequest
      .findMany({ where: { userId: user.id, status: "PENDING" }, include: requestInclude, orderBy: { startDate: "asc" } })
      .then((rows) => withReturnDates(rows.map(toRequestRow))),
    countPendingApprovals(user),
    user.role === "EMPLOYEE" ? Promise.resolve([] as TeamMember[]) : getTeam(user),
  ]);

  const dateLabel = formatDateKey(today, "EEEE, d MMMM yyyy");
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} description={dateLabel} />
      <div className="space-y-6">
        {user.role === "ADMIN" && <CompanyToday team={team} pendingApprovals={approvals} />}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <CheckInCard
              dateLabel={dateLabel}
              record={todayState.record}
              result={todayState.result}
              blockedReason={todayState.holidayName ? `Holiday: ${todayState.holidayName}` : todayState.checkInBlockedReason}
            />
          </div>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>This month</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/attendance">
                    Details <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <MonthSummary days={monthDays} compact />
            </CardContent>
          </Card>
        </div>

        {user.role === "MANAGER" && <TeamToday team={team} pendingApprovals={approvals} />}

        <Card>
          <CardHeader>
            <CardTitle>Leave balances {year}</CardTitle>
            <CardAction>
              <Button asChild size="sm">
                <Link href="/leave">Apply for leave</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <BalanceCards balances={balances} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming holidays</CardTitle>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/holidays">
                    All <ArrowRight />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {holidays.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No upcoming holidays" />
              ) : (
                <ul className="divide-y">
                  {holidays.slice(0, 3).map((h) => (
                    <li key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium">{h.name}</span>
                      <span className="text-muted-foreground">{formatDateKey(h.date, "EEE, dd MMM yyyy")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My pending requests</CardTitle>
            </CardHeader>
            <CardContent>
              {myPending.length === 0 ? (
                <EmptyState icon={Hourglass} title="No pending requests" />
              ) : (
                <ul className="divide-y">
                  {myPending.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span>
                        <span className="font-medium">{r.leaveTypeName}</span>
                        <span className="block text-muted-foreground">
                          {formatRange(r.start, r.end, { weekday: true })} · {r.days} working day{r.days === 1 ? "" : "s"}
                        </span>
                        <BackInOffice back={r.back} today={today} />
                      </span>
                      <LeaveStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function PendingApprovalsCard({ count }: { count: number }) {
  return (
    <Link
      href="/approvals"
      className="flex h-fit items-center gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      data-testid="pending-approvals"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CheckSquare className="size-5" aria-hidden />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-semibold tabular-nums">{count}</p>
        <p className="text-sm text-muted-foreground">Pending approval{count === 1 ? "" : "s"}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function TeamToday({ team, pendingApprovals }: { team: TeamMember[]; pendingApprovals: number }) {
  const groups = [
    { label: "Checked in", tone: "PRESENT" as const, members: team.filter((m) => m.today?.record && !m.today.record.isLate) },
    { label: "Late", tone: "LATE" as const, members: team.filter((m) => m.today?.record?.isLate) },
    { label: "On leave", tone: "ON_LEAVE" as const, members: team.filter((m) => m.today?.result?.status === "ON_LEAVE") },
    {
      label: "Not yet in",
      tone: "ABSENT" as const,
      members: team.filter((m) => !m.today?.record && !m.today?.result && m.today && m.today.date >= m.joinDate.toISOString().slice(0, 10)),
    },
  ];
  const offDay = team.some((m) => m.today?.result?.status === "WEEKEND" || m.today?.result?.status === "HOLIDAY");

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card className="lg:col-span-3" data-testid="team-today">
        <CardHeader>
          <CardTitle>Team today</CardTitle>
          <CardDescription>{team.length} direct report{team.length === 1 ? "" : "s"}</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/team">
                Team <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <EmptyState title="No direct reports" />
          ) : offDay ? (
            <p className="text-sm text-muted-foreground">Today is not a working day.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {groups.map((g) => (
                <div key={g.label}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-2 rounded-full", DAY_META[g.tone].dot)} aria-hidden />
                    {g.label} <span className="text-muted-foreground tabular-nums">({g.members.length})</span>
                  </p>
                  {g.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No one</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {g.members.map((m) => (
                        <li key={m.id}>
                          <Link href={`/team/${m.id}`} className="hover:underline">
                            {m.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <PendingApprovalsCard count={pendingApprovals} />
    </div>
  );
}

function CompanyToday({ team, pendingApprovals }: { team: TeamMember[]; pendingApprovals: number }) {
  const c = countToday(team);
  const stats = [
    { label: "Present", value: c.present, tone: "PRESENT" as const },
    { label: "Late", value: c.late, tone: "LATE" as const },
    { label: "On leave", value: c.onLeave, tone: "ON_LEAVE" as const },
    { label: "Not checked in", value: c.notIn, tone: "ABSENT" as const },
  ];
  const links = [
    { href: "/team", label: "Team status" },
    { href: "/reports", label: "Reports" },
    { href: "/admin/employees", label: "Employees" },
    { href: "/admin/holidays", label: "Holidays" },
    { href: "/admin/branding", label: "Branding" },
    { href: "/admin/audit", label: "Audit log" },
  ];
  return (
    <div className="space-y-4">
      <Card data-testid="company-today">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden /> Company today
          </CardTitle>
          <CardDescription>
            {c.offDay ? "Today is not a working day." : `Out of ${c.total} active employees`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", DAY_META[s.tone].dot)} aria-hidden />
                  {s.label}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {s.value}
                  <span className="text-sm font-normal text-muted-foreground"> / {c.total}</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <PendingApprovalsCard count={pendingApprovals} />
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Button key={l.href} asChild variant="outline">
                <Link href={l.href}>{l.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

