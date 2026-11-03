import { Tags, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { EntityDialog, type FieldDef } from "@/components/admin/entity-dialog";
import { EmptyState } from "@/components/empty-state";
import { ConfirmActionButton } from "@/components/form/confirm-action-button";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { deleteLeaveTypeAction, saveLeaveTypeAction, setLeaveTypeActiveAction } from "@/server/admin-actions";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Leave types" };

const fields: FieldDef[] = [
  { name: "name", label: "Name", hint: "e.g. Casual Leave" },
  { name: "code", label: "Code", hint: "Short unique code, e.g. CL" },
  { name: "annualQuota", label: "Days per year", type: "number", min: 0, max: 365, hint: "Changing this updates this year's allocation for everyone." },
];

export default async function LeaveTypesPage() {
  await requireRole("ADMIN");
  const types = await db.leaveType.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { requests: true } } },
  });

  return (
    <>
      <PageHeader
        title="Leave types"
        description="Each active type gives every employee its yearly quota. There's no carry-forward."
        actions={
          <EntityDialog
            title="Add leave type"
            fields={fields}
            initial={{ name: "", code: "", annualQuota: "12" }}
            save={saveLeaveTypeAction.bind(null, null)}
            editing={false}
            addLabel="Add leave type"
            formId="lt-new"
          />
        }
      />
      <Card>
        <CardContent>
          {types.length === 0 ? (
            <EmptyState icon={Tags} title="No leave types yet" description="Add leave types so employees can apply for leave." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Days / year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} className={t.isActive ? undefined : "text-muted-foreground"}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.code}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.annualQuota}</TableCell>
                    <TableCell>
                      {t.isActive ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800">Active</span>
                      ) : (
                        <span className="inline-flex h-6 items-center rounded-full bg-gray-100 px-2.5 text-xs font-medium text-gray-600">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <EntityDialog
                          title="Edit leave type"
                          fields={fields}
                          initial={{ name: t.name, code: t.code, annualQuota: String(t.annualQuota) }}
                          save={saveLeaveTypeAction.bind(null, t.id)}
                          editing
                          addLabel=""
                          formId={`lt-${t.id}`}
                        />
                        {t.isActive ? (
                          <ConfirmActionButton
                            label="Deactivate"
                            title={`Deactivate ${t.name}?`}
                            description="Employees won't be able to apply for it. Existing requests are kept."
                            confirmLabel="Deactivate"
                            action={setLeaveTypeActiveAction.bind(null, t.id, false)}
                          />
                        ) : (
                          <ConfirmActionButton
                            label="Activate"
                            title={`Activate ${t.name}?`}
                            description="Employees will be able to apply for it again."
                            confirmLabel="Activate"
                            action={setLeaveTypeActiveAction.bind(null, t.id, true)}
                          />
                        )}
                        {t._count.requests === 0 && (
                          <ConfirmActionButton
                            label={
                              <>
                                <Trash2 /> Delete
                              </>
                            }
                            title={`Delete ${t.name}?`}
                            description="It hasn't been used yet, so it can be removed completely."
                            confirmLabel="Delete"
                            destructive
                            action={deleteLeaveTypeAction.bind(null, t.id)}
                          />
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
