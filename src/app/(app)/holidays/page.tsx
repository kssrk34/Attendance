import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateKey } from "@/lib/format";
import { todayKey, yearOf } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { getHolidays } from "@/server/config";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Holidays" };

export default async function HolidaysPage() {
  await requireUser();
  const today = todayKey();
  const year = yearOf(today);
  const holidays = await getHolidays(`${year}-01-01`, `${year}-12-31`);

  return (
    <>
      <PageHeader title="Holidays" description={`Company holidays for ${year}.`} />
      <Card>
        <CardContent>
          {holidays.length === 0 ? (
            <EmptyState icon={CalendarDays} title={`No holidays added for ${year}`} description="HR hasn't published this year's holidays yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Holiday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => {
                  const past = h.date < today;
                  return (
                    <TableRow key={h.id} className={cn(past && "text-muted-foreground")}>
                      <TableCell className="font-medium whitespace-nowrap">{formatDateKey(h.date)}</TableCell>
                      <TableCell>{formatDateKey(h.date, "EEEE")}</TableCell>
                      <TableCell>
                        {h.name}
                        {h.date === today && <span className="ml-2 text-xs font-medium text-primary">Today</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
