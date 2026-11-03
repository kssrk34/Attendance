"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-destructive">Something went wrong</p>
      <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Please try again. If the problem continues, contact your administrator
        {error.digest ? ` and mention reference ${error.digest}` : ""}.
      </p>
      <div className="flex gap-2">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
