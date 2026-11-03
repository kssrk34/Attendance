import "server-only";
import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import { todayKey } from "@/lib/rules";
import { type DayRow, buildDays } from "./attendance";
import type { CurrentUser } from "./session";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: CurrentUser["role"];
  departmentName: string | null;
  joinDate: Date;
  today: DayRow | null;
};

/** Managers see their active direct reports; admins see all active employees (optionally one department). */
export async function getTeam(viewer: CurrentUser, departmentId?: string): Promise<TeamMember[]> {
  let where: Prisma.UserWhereInput;
  if (viewer.role === "ADMIN") where = { isActive: true, ...(departmentId ? { departmentId } : {}) };
  else if (viewer.role === "MANAGER") where = { isActive: true, managerId: viewer.id };
  else return [];

  const users = await db.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, joinDate: true, department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  const today = todayKey();
  const days = await buildDays(users, today, today);
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentName: u.department?.name ?? null,
    joinDate: u.joinDate,
    today: days.get(u.id)?.[0] ?? null,
  }));
}

export type TodayCounts = { total: number; present: number; late: number; onLeave: number; notIn: number; offDay: boolean };

/** Present = checked in today; not in = expected today but no check-in yet. */
export function countToday(members: TeamMember[]): TodayCounts {
  const c: TodayCounts = { total: members.length, present: 0, late: 0, onLeave: 0, notIn: 0, offDay: false };
  for (const m of members) {
    const r = m.today?.result;
    if (m.today?.record) {
      c.present++;
      if (m.today.record.isLate) c.late++;
    } else if (r?.status === "ON_LEAVE") c.onLeave++;
    else if (r?.status === "WEEKEND" || r?.status === "HOLIDAY") c.offDay = true;
    else if (m.today && m.today.date >= m.joinDate.toISOString().slice(0, 10)) c.notIn++;
  }
  return c;
}
