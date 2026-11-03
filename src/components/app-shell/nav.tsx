"use client";

import {
  BarChart3,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  LayoutDashboard,
  Palette,
  ScrollText,
  Settings,
  Tags,
  Umbrella,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/rules/leave";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };
type NavGroup = { label?: string; items: NavItem[] };

const ALL: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];
const LEADS: Role[] = ["MANAGER", "ADMIN"];
const ADMIN: Role[] = ["ADMIN"];

export const NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
      { href: "/attendance", label: "My attendance", icon: CalendarCheck2, roles: ALL },
      { href: "/leave", label: "Leave", icon: Umbrella, roles: ALL },
      { href: "/holidays", label: "Holidays", icon: CalendarDays, roles: ALL },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/team", label: "Team", icon: UsersRound, roles: LEADS },
      { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: LEADS },
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ADMIN },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/employees", label: "Employees", icon: Users, roles: ADMIN },
      { href: "/admin/departments", label: "Departments", icon: Building2, roles: ADMIN },
      { href: "/admin/leave-types", label: "Leave types", icon: Tags, roles: ADMIN },
      { href: "/admin/holidays", label: "Manage holidays", icon: CalendarRange, roles: ADMIN },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ADMIN },
      { href: "/admin/branding", label: "Branding", icon: Palette, roles: ADMIN },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, roles: ADMIN },
    ],
  },
];

export function NavLinks({
  role,
  pendingApprovals,
  onNavigate,
}: {
  role: Role;
  pendingApprovals: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.href === "/approvals" && pendingApprovals > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                      active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground",
                    )}
                    aria-label={`${pendingApprovals} pending`}
                  >
                    {pendingApprovals}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

