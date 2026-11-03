import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/rules/leave";

const LABELS: Record<Role, string> = { EMPLOYEE: "Employee", MANAGER: "Manager", ADMIN: "HR Admin" };

export function roleLabel(role: Role) {
  return LABELS[role];
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "EMPLOYEE" ? "secondary" : "outline"} data-testid="role-badge">
      {LABELS[role]}
    </Badge>
  );
}
