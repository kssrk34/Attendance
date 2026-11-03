"use client";

import { Check, Loader2, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { decideLeaveAction } from "@/server/leave-actions";

function DecideDialog({ id, employee, decision }: { id: string; employee: string; decision: "APPROVE" | "REJECT" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const reject = decision === "REJECT";

  const submit = () => {
    if (reject && !note.trim()) {
      setError("Please explain why this request is rejected.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const res = await decideLeaveAction({ id, decision, note: note.trim() || undefined });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else {
        toast.error(res.error);
        setError(res.fieldErrors?.note);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setNote("");
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={reject ? "outline" : "default"}>
          {reject ? <X /> : <Check />}
          {reject ? "Reject" : "Approve"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {reject ? "Reject" : "Approve"} {employee}&apos;s leave?
          </DialogTitle>
          <DialogDescription>{reject ? "A note is required so they know why." : "You can add an optional note."}</DialogDescription>
        </DialogHeader>
        <Field id={`note-${decision}-${id}`} label={reject ? "Reason for rejection" : "Note (optional)"} error={error}>
          <Textarea
            {...errorProps(`note-${decision}-${id}`, error)}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            name="note"
          />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Back</Button>
          </DialogClose>
          <Button variant={reject ? "destructive" : "default"} onClick={submit} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {reject ? "Reject request" : "Approve request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DecideButtons({ id, employee }: { id: string; employee: string }) {
  return (
    <div className="flex justify-end gap-2">
      <DecideDialog id={id} employee={employee} decision="REJECT" />
      <DecideDialog id={id} employee={employee} decision="APPROVE" />
    </div>
  );
}
