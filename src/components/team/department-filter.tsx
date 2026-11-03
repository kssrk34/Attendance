"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/** Department dropdown that updates the `dept` query param. */
export function DepartmentFilter({ departments, param = "dept" }: { departments: { id: string; name: string }[]; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Show the picked department right away, while its results load.
  const [value, setValue] = useOptimistic(params.get(param) ?? "");

  return (
    <NativeSelect
      aria-label="Department"
      aria-busy={pending || undefined}
      className={cn("w-48 transition-opacity", pending && "opacity-60")}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        const p = new URLSearchParams(params.toString());
        if (next) p.set(param, next);
        else p.delete(param);
        p.delete("page");
        startTransition(() => {
          setValue(next);
          router.push(`${pathname}${p.size ? `?${p.toString()}` : ""}`);
        });
      }}
    >
      <option value="">All departments</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </NativeSelect>
  );
}
