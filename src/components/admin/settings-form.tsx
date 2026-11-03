"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, errorProps } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkSettings } from "@/lib/rules/calendar";
import { cn } from "@/lib/utils";
import { saveSettingsAction } from "@/server/admin-actions";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function SettingsForm({ initial }: { initial: WorkSettings }) {
  const [v, setV] = useState({
    workdayStart: initial.workdayStart,
    lateGraceMinutes: String(initial.lateGraceMinutes),
    halfDayMinHours: String(initial.halfDayMinHours),
    fullDayMinHours: String(initial.fullDayMinHours),
    workingDays: initial.workingDays,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSettingsAction(v);
      if (res.ok) {
        toast.success(res.message);
        setErrors({});
      } else {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  };

  const toggleDay = (d: number) =>
    setV((s) => ({ ...s, workingDays: s.workingDays.includes(d) ? s.workingDays.filter((x) => x !== d) : [...s.workingDays, d] }));

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="workdayStart" label="Workday starts at" error={errors.workdayStart} hint="Company time (IST).">
          <Input {...errorProps("workdayStart", errors.workdayStart)} type="time" value={v.workdayStart} onChange={(e) => setV({ ...v, workdayStart: e.target.value })} />
        </Field>
        <Field id="lateGraceMinutes" label="Late after (grace minutes)" error={errors.lateGraceMinutes} hint="Check-ins after start + grace are late.">
          <Input {...errorProps("lateGraceMinutes", errors.lateGraceMinutes)} type="number" min={0} max={240} value={v.lateGraceMinutes} onChange={(e) => setV({ ...v, lateGraceMinutes: e.target.value })} />
        </Field>
        <Field id="halfDayMinHours" label="Present needs at least (hours)" error={errors.halfDayMinHours} hint="Fewer hours count as a half day.">
          <Input {...errorProps("halfDayMinHours", errors.halfDayMinHours)} type="number" step={0.5} min={0.5} max={24} value={v.halfDayMinHours} onChange={(e) => setV({ ...v, halfDayMinHours: e.target.value })} />
        </Field>
        <Field id="fullDayMinHours" label="Full day (hours)" error={errors.fullDayMinHours} hint="Shorter days are highlighted in the attendance log.">
          <Input {...errorProps("fullDayMinHours", errors.fullDayMinHours)} type="number" step={0.5} min={0.5} max={24} value={v.fullDayMinHours} onChange={(e) => setV({ ...v, fullDayMinHours: e.target.value })} />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Working days</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = v.workingDays.includes(d.value);
            return (
              <label
                key={d.value}
                className={cn(
                  "flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium select-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleDay(d.value)} />
                {d.label}
              </label>
            );
          })}
        </div>
        {errors.workingDays && <p className="text-sm text-destructive">{errors.workingDays}</p>}
      </fieldset>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Save settings
      </Button>
    </form>
  );
}
