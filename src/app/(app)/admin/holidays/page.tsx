import { CalendarDays, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateKey } from "@/lib/format";
import { firstParam } from "@/lib/month-param";
import { todayKey, yearOf } from "@/lib/rules";
import { deleteHolidayAction, saveHolidayAction } from "@/server/admin-actions";
import { getHolidays } from "@/server/config";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Manage holidays" };

const fields: FieldDef[] = [
  { name: "date", label: "Date", type: "date" },
  { name: "name", label: "Name", hint: "e.g. Diwali" },
];

export default async function AdminHolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
  await requireRole("ADMIN");
  const current = yearOf(todayKey());
  const requested = Number(firstParam((await searchParams).year));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : current;
  const holidays = await getHolidays(`${year}-01-01`, `${year}-12-31`);

  return (
    <>
      <PageHeader
        title="Manage holidays"
        description="Holidays aren't counted as leave days and block check-in."
        actions={
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Year">
              {[year - 1, year, year + 1].map((y) => (
                <Button key={y} asChild variant={y === year ? "default" : "outline"} size="lg">
                  <Link href={`/admin/holidays?year=${y}`} aria-current={y === year ? "page" : undefined}>
                    {y}
                  </Link>
                </Button>
              ))}
            </div>
            <EntityDialog
              title="Add holiday"
              fields={fields}
              initial={{ date: year === current ? todayKey() : `${year}-01-01`, name: "" }}
              save={saveHolidayAction.bind(null, null)}
              editing={false}
              addLabel="Add holiday"
              formId="hol-new"
            />
          </>
        }
      />
      <Card>
        <CardContent>
          {holidays.length === 0 ? (
            <EmptyState icon={CalendarDays} title={`No holidays for ${year}`} description="Add the holidays your company observes." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium whitespace-nowrap">{formatDateKey(h.date)}</TableCell>
                    <TableCell>{formatDateKey(h.date, "EEEE")}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <EntityDialog
                          title="Edit holiday"
                          fields={fields}
                          initial={{ date: h.date, name: h.name }}
                          save={saveHolidayAction.bind(null, h.id)}
                          editing
                          addLabel=""
                          formId={`hol-${h.id}`}
                        />
                        <ConfirmActionButton
                          label={
                            <>
                              <Trash2 /> Delete
                            </>
                          }
                          title={`Delete ${h.name}?`}
                          description="It will become a normal working day."
                          confirmLabel="Delete"
                          destructive
                          action={deleteHolidayAction.bind(null, h.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
