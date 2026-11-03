import { Building2, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { EntityDialog } from "@/components/admin/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { deleteDepartmentAction, saveDepartmentAction } from "@/server/admin-actions";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Departments" };

const fields = [{ name: "name", label: "Department name" }];

export default async function DepartmentsPage() {
  await requireRole("ADMIN");
  const departments = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <>
      <PageHeader
        title="Departments"
        actions={
          <EntityDialog
            title="Add department"
            fields={fields}
            initial={{ name: "" }}
            save={saveDepartmentAction.bind(null, null)}
            editing={false}
            addLabel="Add department"
            formId="dept-new"
          />
        }
      />
      <Card>
        <CardContent>
          {departments.length === 0 ? (
            <EmptyState icon={Building2} title="No departments yet" description="Add departments to organise employees." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{d._count.users}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <EntityDialog
                          title="Rename department"
                          fields={fields}
                          initial={{ name: d.name }}
                          save={saveDepartmentAction.bind(null, d.id)}
                          editing
                          addLabel=""
                          formId={`dept-${d.id}`}
                        />
                        {d._count.users === 0 ? (
                          <ConfirmActionButton
                            label={
                              <>
                                <Trash2 /> Delete
                              </>
                            }
                            title={`Delete ${d.name}?`}
                            description="This can't be undone."
                            confirmLabel="Delete"
                            destructive
                            action={deleteDepartmentAction.bind(null, d.id)}
                          />
                        ) : (
                          <span className="self-center text-xs text-muted-foreground" title="Move its employees first">
                            Has employees
                          </span>
                        )}
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
