"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Search box that updates the `q` query param after a short pause. */
export function SearchInput({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (value.trim() === current) return;
      const p = new URLSearchParams(params.toString());
      if (value.trim()) p.set("q", value.trim());
      else p.delete("q");
      p.delete("page");
      router.replace(`${pathname}${p.size ? `?${p.toString()}` : ""}`);
    }, 300);
    return () => clearTimeout(id);
  }, [value, params, pathname, router]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input aria-label="Search" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="pl-8" />
    </div>
  );
}
