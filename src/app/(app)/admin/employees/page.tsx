import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmployeeDialog } from "@/components/admin/employee-dialog";
import { SearchInput } from "@/components/admin/search-input";
import { EmptyState } from "@/components/empty-state";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { roleLabel } from "@/components/role-badge";
import { DepartmentFilter } from "@/components/team/department-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import { formatDateKey } from "@/lib/format";
import { firstParam } from "@/lib/month-param";
import { dbDateToKey, todayKey } from "@/lib/rules";
import { setEmployeeActiveAction } from "@/server/admin-actions";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() ?? "";
  const dept = firstParam(sp.dept);

  const where: Prisma.UserWhereInput = {
    ...(dept ? { departmentId: dept } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
  };

  const [employees, departments, managers] = await Promise.all([
    db.user.findMany({
      where,
      include: { department: { select: { name: true } }, manager: { select: { name: true } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    db.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { isActive: true, role: { in: ["MANAGER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const today = todayKey();

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${employees.filter((e) => e.isActive).length} active · ${employees.filter((e) => !e.isActive).length} deactivated`}
        actions={<EmployeeDialog departments={departments} managers={managers} today={today} />}
      />
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput placeholder="Search name or email" />
            <DepartmentFilter departments={departments} />
          </div>
          {employees.length === 0 ? (
            <EmptyState icon={Users} title="No employees found" description={q || dept ? "Try a different search or department." : "Add your first employee."} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id} data-testid="employee-row" className={e.isActive ? undefined : "text-muted-foreground"}>
                    <TableCell>
                      <Link href={`/team/${e.id}`} className="link">
                        {e.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </TableCell>
                    <TableCell>{roleLabel(e.role)}</TableCell>
                    <TableCell>{e.department?.name ?? "—"}</TableCell>
                    <TableCell>{e.manager?.name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateKey(dbDateToKey(e.joinDate))}</TableCell>
                    <TableCell>
                      {e.isActive ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800">Active</span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-600">Deactivated</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <EmployeeDialog
                          departments={departments}
                          managers={managers}
                          today={today}
                          employee={{
                            id: e.id,
                            values: {
                              name: e.name,
                              email: e.email,
                              role: e.role,
                              departmentId: e.departmentId ?? "",
                              managerId: e.managerId ?? "",
                              joinDate: dbDateToKey(e.joinDate),
                            },
                          }}
                        />
                        {e.id !== admin.id &&
                          (e.isActive ? (
                            <ConfirmActionButton
                              label="Deactivate"
                              title={`Deactivate ${e.name}?`}
                              description="They won't be able to log in and will be left out of stats. You can reactivate them later."
                              confirmLabel="Deactivate"
                              destructive
                              action={setEmployeeActiveAction.bind(null, e.id, false)}
                            />
                          ) : (
                            <ConfirmActionButton
                              label="Reactivate"
                              title={`Reactivate ${e.name}?`}
                              description="They'll be able to log in again."
                              confirmLabel="Reactivate"
                              action={setEmployeeActiveAction.bind(null, e.id, true)}
                            />
                          ))}
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
