import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center" data-testid="forbidden">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="size-6 text-destructive" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-destructive">403</p>
      <h1 className="text-2xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This area is only available to other roles. If you think this is a mistake, contact HR.
      </p>
      <Button asChild size="lg">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
