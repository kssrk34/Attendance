"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
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

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date";
  hint?: string;
  min?: number;
  max?: number;
};

type Result = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Generic add/edit dialog for simple admin records. */
export function EntityDialog<T extends Record<string, string>>({
  title,
  description,
  fields,
  initial,
  save,
  editing,
  addLabel,
  formId,
}: {
  title: string;
  description?: string;
  fields: FieldDef[];
  initial: T;
  save: (values: T) => Promise<Result>;
  editing: boolean;
  addLabel: string;
  formId: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await save(values);
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
          setValues(initial);
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button size="lg">
            <Plus /> {addLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
          {fields.map((f) => {
            const id = `${formId}-${f.name}`;
            return (
              <Field key={f.name} id={id} label={f.label} error={errors[f.name]} hint={f.hint}>
                <Input
                  {...errorProps(id, errors[f.name])}
                  name={f.name}
                  type={f.type ?? "text"}
                  min={f.min}
                  max={f.max}
                  value={(values as Record<string, string>)[f.name] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }) as T)}
                />
              </Field>
            );
          })}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
