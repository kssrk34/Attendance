"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * Friendly error message for error.tsx boundaries. "Try again" uses `retry()`, which
 * re-fetches the page from the server (`reset()` would only re-render the same failed result).
 */
export function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startTransition] = useTransition();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <p className="text-sm font-semibold text-destructive">Something went wrong</p>
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Please try again. If the problem continues, contact your administrator
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <div className="flex gap-2">
        <Button size="lg" disabled={retrying} onClick={() => startTransition(() => retry())}>
          <RotateCw className={retrying ? "animate-spin" : undefined} />
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
