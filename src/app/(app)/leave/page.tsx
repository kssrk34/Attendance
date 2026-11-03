import type { Metadata } from "next";
import { ApplyLeaveForm, type LeaveTypeOption } from "@/components/leave/apply-leave-form";
import { BalanceCards } from "@/components/leave/balance-cards";
import { RequestList } from "@/components/leave/request-list";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDaysKey, todayKey, yearOf } from "@/lib/rules";
import { getHolidays, getSettings } from "@/server/config";
import { getBalances, getUserRequests, withReturnDates } from "@/server/leave";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const user = await requireUser();
  const today = todayKey();
  const year = yearOf(today);
  // A request may start up to 7 days back, which can be last year in early January.
  const years = [...new Set([yearOf(addDaysKey(today, -7)), year, year + 1])];

  const [balancesByYear, requests, settings, holidays] = await Promise.all([
    Promise.all(years.map(async (y) => [y, await getBalances(user.id, y)] as const)),
    getUserRequests(user.id).then(withReturnDates),
    getSettings(),
    // Into the next January too, so a leave ending on 31 Dec gets the right "back in office" day.
    getHolidays(`${years[0]}-01-01`, `${years[years.length - 1] + 1}-01-31`),
  ]);

  const current = balancesByYear.find(([y]) => y === year)?.[1] ?? [];
  const types: LeaveTypeOption[] = current.map((b) => ({
    id: b.leaveTypeId,
    name: b.name,
    code: b.code,
    balances: Object.fromEntries(
      balancesByYear.map(([y, rows]) => {
        const r = rows.find((x) => x.leaveTypeId === b.leaveTypeId);
        return [y, { allocated: r?.allocated ?? 0, used: r?.used ?? 0, pending: r?.pending ?? 0 }];
      }),
    ),
  }));
  const existing = requests
    .filter((r) => r.status === "PENDING" || r.status === "APPROVED")
    .map((r) => ({ start: r.start, end: r.end, status: r.status }));

  return (
    <>
      <PageHeader title="Leave" description={`Your balances for ${year} and your requests.`} />
      <div className="space-y-6">
        <BalanceCards balances={current} />
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Apply for leave</CardTitle>
              <CardDescription>Only working days are taken from your balance. Weekends and holidays are free.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApplyLeaveForm
                today={today}
                types={types}
                holidays={holidays.map((h) => ({ date: h.date, name: h.name }))}
                workingDays={settings.workingDays}
                existing={existing}
              />
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>My requests</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestList requests={requests} allowCancel />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
