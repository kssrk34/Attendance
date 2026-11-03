import type { Metadata } from "next";
import { MonthPicker } from "@/components/attendance/month-picker";
import { AttendanceMonth } from "@/components/attendance/month-view";
import { PageHeader } from "@/components/page-header";
import { monthTitle, parseMonthParam } from "@/lib/month-param";
import { dbDateToKey, monthOf, monthRange, todayKey } from "@/lib/rules";
import { getUserDays } from "@/server/attendance";
import { getSettings } from "@/server/config";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "My attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const user = await requireUser();
  const month = parseMonthParam((await searchParams).month);
  const { start, end } = monthRange(month);
  const [days, settings] = await Promise.all([getUserDays(user, start, end), getSettings()]);

  return (
    <>
      <PageHeader
        title="My attendance"
        description={monthTitle(month)}
        actions={<MonthPicker month={month} maxMonth={monthOf(todayKey())} minMonth={monthOf(dbDateToKey(user.joinDate))} />}
      />
      <AttendanceMonth days={days} fullDayMinHours={settings.fullDayMinHours} />
    </>
  );
}
