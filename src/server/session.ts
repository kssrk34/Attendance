import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/rules";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  managerId: string | null;
  joinDate: Date;
};

/**
 * The signed-in user, loaded fresh from the database on every request so that
 * role changes and deactivation take effect immediately. Null if signed out or inactive.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, departmentId: true, managerId: true, joinDate: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  const { isActive: _active, ...rest } = user;
  void _active;
  return rest;
});

/** For pages: redirect to login if signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: redirect to the 403 page if the user lacks one of the roles. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function assertUser(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new PermissionError("Your session has expired. Please log in again.");
  if (roles.length > 0 && !roles.includes(user.role)) throw new PermissionError();
  return user;
}

/**
 * Whether `viewer` may see `target`'s attendance and leave: themselves,
 * an admin, or the target's direct manager.
 */
export async function canViewUser(viewer: CurrentUser, targetId: string): Promise<boolean> {
  if (viewer.id === targetId || viewer.role === "ADMIN") return true;
  if (viewer.role !== "MANAGER") return false;
  const target = await db.user.findUnique({ where: { id: targetId }, select: { managerId: true } });
  return target?.managerId === viewer.id;
}
