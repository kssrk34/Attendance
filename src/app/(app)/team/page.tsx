import { formatInTimeZone } from "date-fns-tz";
import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { roleLabel } from "@/components/role-badge";
import { DayStatusBadge } from "@/components/status-badge";
import { DepartmentFilter } from "@/components/team/department-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { firstParam } from "@/lib/month-param";
import { TIMEZONE } from "@/lib/rules";
import { requireRole } from "@/server/session";
import { getTeam } from "@/server/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const user = await requireRole("MANAGER", "ADMIN");
  const isAdmin = user.role === "ADMIN";
  const departments = isAdmin ? await db.department.findMany({ orderBy: { name: "asc" } }) : [];
  const deptParam = firstParam((await searchParams).dept);
  const dept = departments.some((d) => d.id === deptParam) ? deptParam : undefined;
  const team = await getTeam(user, dept);

  return (
    <>
      <PageHeader
        title="Team"
        description={isAdmin ? "Everyone in the company and their status today." : "Your direct reports and their status today."}
        actions={isAdmin ? <DepartmentFilter departments={departments} /> : undefined}
      />
      <Card>
        <CardContent>
          {team.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={isAdmin ? "No employees found" : "No direct reports"}
              description={isAdmin ? "Try another department." : "Ask HR to assign employees to you."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  {isAdmin && <TableHead>Role</TableHead>}
                  <TableHead>Today</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((m) => (
                  <TableRow key={m.id} data-testid="team-row">
                    <TableCell>
                      <Link href={`/team/${m.id}`} className="link">
                        {m.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </TableCell>
                    <TableCell>{m.departmentName ?? "—"}</TableCell>
                    {isAdmin && <TableCell>{roleLabel(m.role)}</TableCell>}
                    <TableCell>
                      <DayStatusBadge result={m.today?.result ?? null} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {m.today?.record ? formatInTimeZone(m.today.record.checkInAt, TIMEZONE, "hh:mm a") : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {m.today?.record?.checkOutAt ? formatInTimeZone(m.today.record.checkOutAt, TIMEZONE, "hh:mm a") : "—"}
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
