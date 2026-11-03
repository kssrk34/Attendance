"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, errorProps } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateKey } from "@/lib/format";
import { validateLeaveRequest, type LeaveStatus } from "@/lib/rules/leave";
import { addDaysKey, isDateKey, yearOf } from "@/lib/rules/time";
import { applyLeaveAction } from "@/server/leave-actions";
import { LeavePreview } from "./leave-preview";

export type LeaveTypeOption = {
  id: string;
  name: string;
  code: string;
  /** Per year: allocated, used and pending for this type. */
  balances: Record<number, { allocated: number; used: number; pending: number }>;
};

type Props = {
  today: string;
  types: LeaveTypeOption[];
  holidays: { date: string; name: string }[];
  workingDays: number[];
  existing: { start: string; end: string; status: LeaveStatus }[];
};

export function ApplyLeaveForm({ today, types, holidays, workingDays, existing }: Props) {
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const holidayNames = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);
  const holidaySet = useMemo(() => new Set(holidayNames.keys()), [holidayNames]);
  const type = types.find((t) => t.id === leaveTypeId);

  // Live preview using the same rules the server enforces.
  const preview = useMemo(() => {
    if (!type || !isDateKey(startDate) || !isDateKey(endDate)) return null;
    const year = yearOf(startDate);
    const b = type.balances[year] ?? { allocated: type.balances[yearOf(today)]?.allocated ?? 0, used: 0, pending: 0 };
    const available = b.allocated - b.used - b.pending;
    const result = validateLeaveRequest({
      start: startDate,
      end: endDate,
      today,
      settings: { workingDays },
      holidays: holidaySet,
      existing,
      balance: { allocated: b.allocated, used: b.used },
      pendingDays: b.pending,
    });
    return { result, available };
  }, [type, startDate, endDate, today, workingDays, holidaySet, existing]);

  if (types.length === 0) {
    return <p className="text-sm text-muted-foreground">No leave types are available yet. Please contact HR.</p>;
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!leaveTypeId) local.leaveTypeId = "Choose a leave type";
    if (!isDateKey(startDate)) local.startDate = "Choose a start date";
    if (!isDateKey(endDate)) local.endDate = "Choose an end date";
    if (reason.trim().length < 3) local.reason = "Please give a short reason (at least 3 characters)";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    startTransition(async () => {
      const res = await applyLeaveAction({ leaveTypeId, startDate, endDate, reason });
      if (res.ok) {
        toast.success(res.message);
        setStartDate("");
        setEndDate("");
        setReason("");
        setErrors({});
      } else {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  };

  const minDate = addDaysKey(today, -7);
  // The weekday under each date, so it's obvious when a range runs over a weekend.
  const weekdayHint = (key: string) => (isDateKey(key) ? formatDateKey(key, "EEEE") : undefined);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate data-testid="apply-leave-form">
      <Field id="leaveTypeId" label="Leave type" error={errors.leaveTypeId}>
        <NativeSelect {...errorProps("leaveTypeId", errors.leaveTypeId)} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="startDate" label="First day of leave" hint={weekdayHint(startDate)} error={errors.startDate}>
          <Input
            type="date"
            {...errorProps("startDate", errors.startDate)}
            min={minDate}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
        </Field>
        <Field id="endDate" label="Last day of leave" hint={weekdayHint(endDate)} error={errors.endDate}>
          <Input type="date" {...errorProps("endDate", errors.endDate)} min={startDate || minDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite" data-testid="leave-preview">
        {!preview || !type ? (
          <p className="text-muted-foreground">Pick your dates to see how many working days this uses and when you&apos;ll be back in office.</p>
        ) : (
          <LeavePreview
            start={startDate}
            end={endDate}
            today={today}
            result={preview.result}
            available={preview.available}
            leaveTypeName={type.name}
            workingDays={workingDays}
            holidays={holidaySet}
            holidayNames={holidayNames}
            existing={existing}
          />
        )}
      </div>

      <Field id="reason" label="Reason" error={errors.reason}>
        <Textarea {...errorProps("reason", errors.reason)} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Family function" />
      </Field>

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || (preview !== null && !preview.result.ok)}>
        {pending && <Loader2 className="animate-spin" />}
        Submit request
      </Button>
    </form>
  );
}
