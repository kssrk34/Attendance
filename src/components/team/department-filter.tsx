"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** Department dropdown that updates the `dept` query param. */
export function DepartmentFilter({ departments, param = "dept" }: { departments: { id: string; name: string }[]; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "";

  return (
    <NativeSelect
      aria-label="Department"
      className="w-48"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString());
        if (e.target.value) p.set(param, e.target.value);
        else p.delete(param);
        p.delete("page");
        router.push(`${pathname}${p.size ? `?${p.toString()}` : ""}`);
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
