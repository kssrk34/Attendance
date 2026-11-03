"use server";

import bcrypt from "bcryptjs";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  HEX_COLOR_RE,
  isDateKey,
  keyToDbDate,
  todayKey,
  validateLogo,
  yearOf,
} from "@/lib/rules";
import { type ActionResult, UserError, parseInput, runAction } from "./action-result";
import { writeAudit } from "./audit";
import { BRANDING_TAG } from "./config";
import { ensureBalances } from "./leave";
import { assertUser } from "./session";

const isUniqueError = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

function done(message: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/* -------------------------------------------------------------------------- */
/*                                  Employees                                 */
/* -------------------------------------------------------------------------- */

const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  role: z.enum(["EMPLOYEE", "MANAGER", "ADMIN"], { message: "Choose a role" }),
  departmentId: z.string().min(1, "Choose a department"),
  managerId: z.string().optional().transform((v) => v || null),
  joinDate: z.string().refine(isDateKey, "Enter a valid join date"),
  password: z.string().optional().transform((v) => v || ""),
});

export type EmployeeInput = z.input<typeof employeeSchema>;

async function validateManager(managerId: string | null, selfId?: string) {
  if (!managerId) return;
  if (managerId === selfId) throw new UserError("Please fix the highlighted fields.", { managerId: "Someone can't be their own manager." });
  const m = await db.user.findUnique({ where: { id: managerId }, select: { role: true, isActive: true, managerId: true } });
  if (!m || !m.isActive || (m.role !== "MANAGER" && m.role !== "ADMIN")) {
    throw new UserError("Please fix the highlighted fields.", { managerId: "Choose an active manager or admin." });
  }
  if (selfId) {
    // Prevent cycles: walk up from the new manager and make sure we never reach this employee.
    let cursor: string | null = m.managerId;
    for (let i = 0; cursor && i < 50; i++) {
      if (cursor === selfId) {
        throw new UserError("Please fix the highlighted fields.", { managerId: "That would create a reporting loop." });
      }
      const next: { managerId: string | null } | null = await db.user.findUnique({ where: { id: cursor }, select: { managerId: true } });
      cursor = next?.managerId ?? null;
    }
  }
}

async function validateDepartment(departmentId: string) {
  const d = await db.department.findUnique({ where: { id: departmentId } });
  if (!d) throw new UserError("Please fix the highlighted fields.", { departmentId: "Choose a department." });
}

export async function createEmployeeAction(input: EmployeeInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(employeeSchema, input);
    if (data.password.length < 8) {
      throw new UserError("Please fix the highlighted fields.", { password: "Password must be at least 8 characters." });
    }
    await validateDepartment(data.departmentId);
    await validateManager(data.managerId);

    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            role: data.role,
            departmentId: data.departmentId,
            managerId: data.managerId,
            joinDate: keyToDbDate(data.joinDate),
            passwordHash: await bcrypt.hash(data.password, 10),
          },
        });
        await ensureBalances(user.id, yearOf(todayKey()), tx);
        await writeAudit(tx, {
          actorId: admin.id,
          action: "EMPLOYEE_CREATED",
          entityType: "User",
          entityId: user.id,
          details: { name: data.name, email: data.email, role: data.role },
        });
      });
    } catch (err) {
      if (isUniqueError(err)) throw new UserError("Please fix the highlighted fields.", { email: "An account with this email already exists." });
      throw err;
    }
    return done(`${data.name} was added.`);
  });
}

export async function updateEmployeeAction(id: string, input: EmployeeInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(employeeSchema, input);
    const existing = await db.user.findUnique({
      where: { id },
      include: { _count: { select: { reports: { where: { isActive: true } } } } },
    });
    if (!existing) throw new UserError("Employee not found.");
    if (data.password && data.password.length < 8) {
      throw new UserError("Please fix the highlighted fields.", { password: "Password must be at least 8 characters." });
    }
    if (id === admin.id && data.role !== "ADMIN") {
      throw new UserError("Please fix the highlighted fields.", { role: "You can't remove your own admin role." });
    }
    if (data.role === "EMPLOYEE" && existing.role !== "EMPLOYEE" && existing._count.reports > 0) {
      throw new UserError("Please fix the highlighted fields.", {
        role: `${existing.name} still has ${existing._count.reports} direct report(s). Reassign them first.`,
      });
    }
    await validateDepartment(data.departmentId);
    await validateManager(data.managerId, id);

    const changes: Record<string, unknown> = {};
    if (existing.name !== data.name) changes.name = data.name;
    if (existing.email !== data.email) changes.email = data.email;
    if (existing.role !== data.role) changes.role = data.role;
    if (existing.departmentId !== data.departmentId) changes.departmentId = data.departmentId;
    if (existing.managerId !== data.managerId) changes.managerId = data.managerId;
    if (existing.joinDate.toISOString().slice(0, 10) !== data.joinDate) changes.joinDate = data.joinDate;
    if (data.password) changes.password = "reset";

    try {
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            name: data.name,
            email: data.email,
            role: data.role,
            departmentId: data.departmentId,
            managerId: data.managerId,
            joinDate: keyToDbDate(data.joinDate),
            ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
          },
        });
        await writeAudit(tx, { actorId: admin.id, action: "EMPLOYEE_UPDATED", entityType: "User", entityId: id, details: changes as Prisma.InputJsonValue });
      });
    } catch (err) {
      if (isUniqueError(err)) throw new UserError("Please fix the highlighted fields.", { email: "An account with this email already exists." });
      throw err;
    }
    return done(`${data.name} was updated.`);
  });
}

export async function setEmployeeActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    if (id === admin.id && !active) throw new UserError("You can't deactivate your own account.");
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new UserError("Employee not found.");
    if (user.isActive === active) return done(active ? `${user.name} is already active.` : `${user.name} is already deactivated.`);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { isActive: active } });
      if (active) await ensureBalances(id, yearOf(todayKey()), tx);
      await writeAudit(tx, {
        actorId: admin.id,
        action: active ? "EMPLOYEE_REACTIVATED" : "EMPLOYEE_DEACTIVATED",
        entityType: "User",
        entityId: id,
        details: { name: user.name },
      });
    });
    return done(active ? `${user.name} was reactivated.` : `${user.name} was deactivated and can no longer log in.`);
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Departments                                */
/* -------------------------------------------------------------------------- */

const departmentSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters").max(60) });

export async function saveDepartmentAction(id: string | null, input: { name: string }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(departmentSchema, input);
    try {
      await db.$transaction(async (tx) => {
        const dept = id
          ? await tx.department.update({ where: { id }, data: { name: data.name } })
          : await tx.department.create({ data: { name: data.name } });
        await writeAudit(tx, {
          actorId: admin.id,
          action: id ? "DEPARTMENT_UPDATED" : "DEPARTMENT_CREATED",
          entityType: "Department",
          entityId: dept.id,
          details: { name: data.name },
        });
      });
    } catch (err) {
      if (isUniqueError(err)) throw new UserError("Please fix the highlighted fields.", { name: "A department with this name already exists." });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new UserError("Department not found.");
      throw err;
    }
    return done(id ? "Department renamed." : `Department “${data.name}” created.`);
  });
}

export async function deleteDepartmentAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const dept = await db.department.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!dept) throw new UserError("Department not found.");
    if (dept._count.users > 0) {
      throw new UserError(`Can't delete “${dept.name}”: it still has ${dept._count.users} employee(s). Move them first.`);
    }
    await db.$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });
      await writeAudit(tx, { actorId: admin.id, action: "DEPARTMENT_DELETED", entityType: "Department", entityId: id, details: { name: dept.name } });
    });
    return done(`Department “${dept.name}” deleted.`);
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Leave types                                */
/* -------------------------------------------------------------------------- */

const leaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, "Use 1–10 letters or digits, e.g. CL"),
  annualQuota: z.coerce.number({ message: "Enter a number" }).int("Use whole days").min(0, "Can't be negative").max(365, "At most 365 days"),
});

export type LeaveTypeInput = z.input<typeof leaveTypeSchema>;

/** Give every active user a balance row for this type in the current year. */
async function allocateToAll(tx: Prisma.TransactionClient, leaveTypeId: string, quota: number) {
  const year = yearOf(todayKey());
  const users = await tx.user.findMany({ where: { isActive: true }, select: { id: true } });
  await tx.leaveBalance.createMany({
    data: users.map((u) => ({ userId: u.id, leaveTypeId, year, allocated: quota, used: 0 })),
    skipDuplicates: true,
  });
}

export async function saveLeaveTypeAction(id: string | null, input: LeaveTypeInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(leaveTypeSchema, input);
    try {
      await db.$transaction(async (tx) => {
        if (id) {
          const before = await tx.leaveType.findUnique({ where: { id } });
          if (!before) throw new UserError("Leave type not found.");
          await tx.leaveType.update({ where: { id }, data });
          if (before.annualQuota !== data.annualQuota) {
            // Quota changes apply to this year's allocations.
            await tx.leaveBalance.updateMany({ where: { leaveTypeId: id, year: yearOf(todayKey()) }, data: { allocated: data.annualQuota } });
          }
          await writeAudit(tx, {
            actorId: admin.id,
            action: "LEAVE_TYPE_UPDATED",
            entityType: "LeaveType",
            entityId: id,
            details: { before: { name: before.name, code: before.code, annualQuota: before.annualQuota }, after: data },
          });
        } else {
          const type = await tx.leaveType.create({ data });
          await allocateToAll(tx, type.id, data.annualQuota);
          await writeAudit(tx, { actorId: admin.id, action: "LEAVE_TYPE_CREATED", entityType: "LeaveType", entityId: type.id, details: data });
        }
      });
    } catch (err) {
      if (isUniqueError(err)) throw new UserError("Please fix the highlighted fields.", { code: "This code is already used by another leave type." });
      throw err;
    }
    return done(id ? "Leave type updated." : `Leave type “${data.name}” created.`);
  });
}

export async function setLeaveTypeActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const type = await db.leaveType.findUnique({ where: { id } });
    if (!type) throw new UserError("Leave type not found.");
    await db.$transaction(async (tx) => {
      await tx.leaveType.update({ where: { id }, data: { isActive: active } });
      if (active) await allocateToAll(tx, id, type.annualQuota);
      await writeAudit(tx, {
        actorId: admin.id,
        action: "LEAVE_TYPE_UPDATED",
        entityType: "LeaveType",
        entityId: id,
        details: { name: type.name, isActive: active },
      });
    });
    return done(active ? `${type.name} reactivated.` : `${type.name} deactivated. Employees can no longer apply for it.`);
  });
}

export async function deleteLeaveTypeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const type = await db.leaveType.findUnique({ where: { id }, include: { _count: { select: { requests: true } } } });
    if (!type) throw new UserError("Leave type not found.");
    if (type._count.requests > 0) throw new UserError(`“${type.name}” has been used in leave requests. Deactivate it instead.`);
    await db.$transaction(async (tx) => {
      await tx.leaveType.delete({ where: { id } });
      await writeAudit(tx, { actorId: admin.id, action: "LEAVE_TYPE_DELETED", entityType: "LeaveType", entityId: id, details: { name: type.name, code: type.code } });
    });
    return done(`Leave type “${type.name}” deleted.`);
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Holidays                                 */
/* -------------------------------------------------------------------------- */

const holidaySchema = z.object({
  date: z.string().refine(isDateKey, "Enter a valid date"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
});

export async function saveHolidayAction(id: string | null, input: { date: string; name: string }): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(holidaySchema, input);
    try {
      await db.$transaction(async (tx) => {
        const h = id
          ? await tx.holiday.update({ where: { id }, data: { date: keyToDbDate(data.date), name: data.name } })
          : await tx.holiday.create({ data: { date: keyToDbDate(data.date), name: data.name } });
        await writeAudit(tx, {
          actorId: admin.id,
          action: id ? "HOLIDAY_UPDATED" : "HOLIDAY_CREATED",
          entityType: "Holiday",
          entityId: h.id,
          details: data,
        });
      });
    } catch (err) {
      if (isUniqueError(err)) throw new UserError("Please fix the highlighted fields.", { date: "There's already a holiday on this date." });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new UserError("Holiday not found.");
      throw err;
    }
    return done(id ? "Holiday updated." : `Holiday “${data.name}” added.`);
  });
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const h = await db.holiday.findUnique({ where: { id } });
    if (!h) throw new UserError("Holiday not found.");
    await db.$transaction(async (tx) => {
      await tx.holiday.delete({ where: { id } });
      await writeAudit(tx, {
        actorId: admin.id,
        action: "HOLIDAY_DELETED",
        entityType: "Holiday",
        entityId: id,
        details: { name: h.name, date: h.date.toISOString().slice(0, 10) },
      });
    });
    return done(`Holiday “${h.name}” deleted.`);
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Settings                                 */
/* -------------------------------------------------------------------------- */

const settingsSchema = z
  .object({
    workdayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm, e.g. 09:30"),
    lateGraceMinutes: z.coerce.number({ message: "Enter a number" }).int("Use whole minutes").min(0, "Can't be negative").max(240, "At most 240 minutes"),
    halfDayMinHours: z.coerce.number({ message: "Enter a number" }).min(0.5, "At least 0.5 hours").max(24, "At most 24 hours"),
    fullDayMinHours: z.coerce.number({ message: "Enter a number" }).min(0.5, "At least 0.5 hours").max(24, "At most 24 hours"),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one working day"),
  })
  .refine((s) => s.fullDayMinHours >= s.halfDayMinHours, {
    message: "A full day can't be shorter than a half day",
    path: ["fullDayMinHours"],
  });

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettingsAction(input: SettingsInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(settingsSchema, input);
    const workingDays = [...new Set(data.workingDays)].sort();
    await db.$transaction(async (tx) => {
      const before = await tx.settings.findUnique({ where: { id: 1 } });
      await tx.settings.upsert({ where: { id: 1 }, create: { id: 1, ...data, workingDays }, update: { ...data, workingDays } });
      await writeAudit(tx, {
        actorId: admin.id,
        action: "SETTINGS_UPDATED",
        entityType: "Settings",
        entityId: "1",
        details: {
          before: before
            ? {
                workdayStart: before.workdayStart,
                lateGraceMinutes: before.lateGraceMinutes,
                halfDayMinHours: before.halfDayMinHours,
                fullDayMinHours: before.fullDayMinHours,
                workingDays: before.workingDays,
              }
            : null,
          after: { ...data, workingDays },
        },
      });
    });
    return done("Settings saved.");
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Branding                                 */
/* -------------------------------------------------------------------------- */

const brandingSchema = z.object({
  appName: z.string().trim().min(2, "At least 2 characters").max(40, "At most 40 characters"),
  companyName: z.string().trim().min(2, "At least 2 characters").max(60, "At most 60 characters"),
  primaryColor: z.string().regex(HEX_COLOR_RE, "Use a hex color like #2563eb").transform((v) => v.toLowerCase()),
  logo: z
    .string()
    .nullable()
    .superRefine((v, ctx) => {
      if (v === null) return;
      const check = validateLogo(v);
      if (!check.ok) ctx.addIssue({ code: "custom", message: check.error });
    }),
});

export type BrandingInput = z.input<typeof brandingSchema>;

export async function saveBrandingAction(input: BrandingInput): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = parseInput(brandingSchema, input);
    await db.$transaction(async (tx) => {
      const before = await tx.branding.findUnique({ where: { id: 1 } });
      await tx.branding.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await writeAudit(tx, {
        actorId: admin.id,
        action: "BRANDING_UPDATED",
        entityType: "Branding",
        entityId: "1",
        details: {
          appName: data.appName,
          companyName: data.companyName,
          primaryColor: data.primaryColor,
          logo: data.logo ? (before?.logo === data.logo ? "unchanged" : "uploaded") : before?.logo ? "removed" : "none",
        },
      });
    });
    updateTag(BRANDING_TAG);
    return done("Branding saved.");
  });
}

export async function resetBrandingAction(): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await assertUser("ADMIN");
    const data = { ...DEFAULT_BRANDING };
    await db.$transaction(async (tx) => {
      await tx.branding.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await writeAudit(tx, { actorId: admin.id, action: "BRANDING_RESET", entityType: "Branding", entityId: "1", details: { appName: data.appName, companyName: data.companyName } });
    });
    updateTag(BRANDING_TAG);
    return done("Branding reset to defaults.");
  });
}
