"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canCheckIn, canCheckOut, formatTime, isLateCheckIn, keyToDbDate, todayKey } from "@/lib/rules";
import { type ActionResult, UserError, runAction } from "./action-result";
import { writeAudit } from "./audit";
import { getHolidaySet, getSettings } from "./config";
import { assertUser } from "./session";

export async function checkInAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    const now = new Date();
    const today = todayKey(now);
    const date = keyToDbDate(today);

    const [settings, holidays, existing, leave] = await Promise.all([
      getSettings(),
      getHolidaySet(today, today),
      db.attendanceRecord.findUnique({ where: { userId_date: { userId: user.id, date } } }),
      db.leaveRequest.findFirst({
        where: { userId: user.id, status: "APPROVED", startDate: { lte: date }, endDate: { gte: date } },
        select: { id: true },
      }),
    ]);

    const check = canCheckIn({ date: today, settings, holidays, onLeave: !!leave, existing });
    if (!check.ok) throw new UserError(check.error);

    const isLate = isLateCheckIn(now, today, settings);
    try {
      await db.$transaction(async (tx) => {
        const rec = await tx.attendanceRecord.create({ data: { userId: user.id, date, checkInAt: now, isLate } });
        await writeAudit(tx, {
          actorId: user.id,
          action: "CHECK_IN",
          entityType: "AttendanceRecord",
          entityId: rec.id,
          details: { date: today, time: formatTime(now), isLate },
        });
      });
    } catch (err) {
      // Unique (userId, date) protects against double taps.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new UserError("You have already checked in today.");
      }
      throw err;
    }

    revalidatePath("/", "layout");
    return { ok: true, message: `Checked in at ${formatTime(now)}${isLate ? " (late)" : ""}.` };
  });
}

export async function checkOutAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    const now = new Date();
    const today = todayKey(now);
    const existing = await db.attendanceRecord.findUnique({
      where: { userId_date: { userId: user.id, date: keyToDbDate(today) } },
    });
    const check = canCheckOut(existing);
    if (!check.ok || !existing) throw new UserError(check.ok ? "You haven't checked in today." : check.error);

    await db.$transaction(async (tx) => {
      // Only update if still open, so a double tap can't check out twice.
      const { count } = await tx.attendanceRecord.updateMany({
        where: { id: existing.id, checkOutAt: null },
        data: { checkOutAt: now },
      });
      if (count === 0) throw new UserError("You have already checked out today.");
      await writeAudit(tx, {
        actorId: user.id,
        action: "CHECK_OUT",
        entityType: "AttendanceRecord",
        entityId: existing.id,
        details: { date: today, time: formatTime(now) },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true, message: `Checked out at ${formatTime(now)}.` };
  });
}
