"use client";

import { Loader2, Pencil, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, errorProps } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type EmployeeInput, createEmployeeAction, updateEmployeeAction } from "@/server/admin-actions";

type Option = { id: string; name: string };

type Props = {
  departments: Option[];
  managers: Option[];
  today: string;
  employee?: { id: string; values: Omit<EmployeeInput, "password"> };
};

const empty = (today: string, departments: Option[]): EmployeeInput => ({
  name: "",
  email: "",
  role: "EMPLOYEE",
  departmentId: departments[0]?.id ?? "",
  managerId: "",
  joinDate: today,
  password: "",
});

export function EmployeeDialog({ departments, managers, today, employee }: Props) {
  const editing = !!employee;
  const initial = (): EmployeeInput => (employee ? { ...employee.values, managerId: employee.values.managerId ?? "", password: "" } : empty(today, departments));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EmployeeInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setValues((s) => ({ ...s, [k]: v }));
  const managerOptions = managers.filter((m) => m.id !== employee?.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = editing ? await updateEmployeeAction(employee.id, values) : await createEmployeeAction(values);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValues(initial());
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm" aria-label={`Edit ${employee.values.name}`}>
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="lg">
            <UserPlus /> Add employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {editing ? "Leave the password blank to keep the current one." : "They can log in with this email and password."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate id="employee-form">
          <Field id="emp-name" label="Full name" error={errors.name}>
            <Input {...errorProps("emp-name", errors.name)} name="name" value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
          </Field>
          <Field id="emp-email" label="Email" error={errors.email}>
            <Input {...errorProps("emp-email", errors.email)} name="email" type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="emp-role" label="Role" error={errors.role}>
              <NativeSelect {...errorProps("emp-role", errors.role)} name="role" value={values.role} onChange={(e) => set("role", e.target.value as EmployeeInput["role"])}>
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">HR Admin</option>
              </NativeSelect>
            </Field>
            <Field id="emp-dept" label="Department" error={errors.departmentId}>
              <NativeSelect {...errorProps("emp-dept", errors.departmentId)} name="departmentId" value={values.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
                {departments.length === 0 && <option value="">No departments yet</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="emp-manager" label="Manager" error={errors.managerId} hint="Leave requests go to this person.">
              <NativeSelect {...errorProps("emp-manager", errors.managerId)} name="managerId" value={values.managerId ?? ""} onChange={(e) => set("managerId", e.target.value)}>
                <option value="">No manager (HR approves)</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="emp-join" label="Join date" error={errors.joinDate}>
              <Input {...errorProps("emp-join", errors.joinDate)} name="joinDate" type="date" value={values.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
            </Field>
          </div>
          <Field id="emp-password" label={editing ? "New password (optional)" : "Initial password"} error={errors.password} hint="At least 8 characters.">
            <Input
              {...errorProps("emp-password", errors.password)}
              name="password"
              type="password"
              autoComplete="new-password"
              value={values.password ?? ""}
              onChange={(e) => set("password", e.target.value)}
            />
          </Field>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="employee-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
