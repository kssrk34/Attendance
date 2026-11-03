"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Search box that updates the `q` query param after a short pause. */
export function SearchInput({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (value.trim() === current) return;
      const p = new URLSearchParams(params.toString());
      if (value.trim()) p.set("q", value.trim());
      else p.delete("q");
      p.delete("page");
      startTransition(() => router.replace(`${pathname}${p.size ? `?${p.toString()}` : ""}`));
    }, 300);
    return () => clearTimeout(id);
  }, [value, params, pathname, router]);

  const Icon = pending ? Loader2 : Search;
  return (
    <div className="relative w-full sm:w-64">
      <Icon
        className={cn(
          "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground",
          pending && "animate-spin",
        )}
        aria-hidden
      />
      <Input
        aria-label="Search"
        aria-busy={pending || undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
