"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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

type Result = { ok: true; message: string } | { ok: false; error: string };

/** A button that asks for confirmation, then runs a (bound) server action and toasts the result. */
export function ConfirmActionButton({
  label,
  title,
  description,
  confirmLabel,
  action,
  destructive = false,
  size = "sm",
  variant = "outline",
}: {
  label: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<Result>;
  destructive?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "destructive";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
      } else toast.error(res.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant={destructive ? "destructive" : "default"} onClick={run} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
