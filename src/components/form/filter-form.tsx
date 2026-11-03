"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useTransition } from "react";
import { Button } from "@/components/ui/button";

const PendingContext = createContext(false);

/**
 * A GET filter form that updates the page in place (no full reload) and keeps the current
 * results on screen until the new ones arrive. Works as a plain form before JavaScript loads.
 */
export function FilterForm({ action, className, children }: { action: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      method="get"
      action={action}
      className={className}
      aria-busy={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(e.currentTarget)) {
          if (typeof value === "string" && value !== "") params.append(key, value);
        }
        const query = params.toString();
        startTransition(() => router.push(query ? `${action}?${query}` : action));
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
    </form>
  );
}

/** Submit button for a FilterForm; shows a spinner while the results load. */
export function FilterSubmit({ children }: { children: React.ReactNode }) {
  const pending = use(PendingContext);
  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
