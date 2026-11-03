"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  canApproveWithBalance,
  canCancel,
  canDecide,
  dbDateToKey,
  isDateKey,
  keyToDbDate,
  todayKey,
  validateLeaveRequest,
  yearOf,
} from "@/lib/rules";
import { type ActionResult, UserError, parseInput, runAction } from "./action-result";
import { writeAudit } from "./audit";
import { getHolidaySet, getSettings } from "./config";
import { ensureBalances, lockBalance, pendingDaysFor } from "./leave";
import { assertUser } from "./session";

const dateKey = z.string().refine(isDateKey, "Enter a valid date");

const applySchema = z.object({
  leaveTypeId: z.string().min(1, "Choose a leave type"),
  startDate: dateKey,
  endDate: dateKey,
  reason: z.string().trim().min(3, "Please give a short reason (at least 3 characters)").max(500, "Keep the reason under 500 characters"),
});

export type ApplyLeaveInput = z.input<typeof applySchema>;

export async function applyLeaveAction(input: ApplyLeaveInput): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    const data = parseInput(applySchema, input);
    const today = todayKey();
    const year = yearOf(data.startDate);

    const type = await db.leaveType.findUnique({ where: { id: data.leaveTypeId } });
    if (!type || !type.isActive) throw new UserError("Please fix the highlighted fields.", { leaveTypeId: "This leave type isn't available." });

    const [settings, holidays] = await Promise.all([getSettings(), getHolidaySet(`${year}-01-01`, `${year}-12-31`)]);

    await db.$transaction(async (tx) => {
      await ensureBalances(user.id, year, tx);
      const balance = await lockBalance(tx, user.id, type.id, year);
      const [existing, pendingDays] = await Promise.all([
        tx.leaveRequest.findMany({
          where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] } },
          select: { startDate: true, endDate: true, status: true },
        }),
        pendingDaysFor(user.id, type.id, year, tx),
      ]);

      const result = validateLeaveRequest({
        start: data.startDate,
        end: data.endDate,
        today,
        settings,
        holidays,
        existing: existing.map((r) => ({ start: dbDateToKey(r.startDate), end: dbDateToKey(r.endDate), status: r.status })),
        balance,
        pendingDays,
      });
      if (!result.ok) {
        throw new UserError(result.error, result.field ? { [result.field === "start" ? "startDate" : "endDate"]: result.error } : undefined);
      }

      const req = await tx.leaveRequest.create({
        data: {
          userId: user.id,
          leaveTypeId: type.id,
          startDate: keyToDbDate(data.startDate),
          endDate: keyToDbDate(data.endDate),
          days: result.days,
          reason: data.reason,
        },
      });
      await writeAudit(tx, {
        actorId: user.id,
        action: "LEAVE_APPLIED",
        entityType: "LeaveRequest",
        entityId: req.id,
        details: { type: type.code, start: data.startDate, end: data.endDate, days: result.days },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true, message: "Leave request submitted for approval." };
  });
}

export async function cancelLeaveAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await assertUser();
    const reqId = parseInput(z.string().min(1), id);
    const today = todayKey();

    await db.$transaction(async (tx) => {
      const req = await tx.leaveRequest.findUnique({ where: { id: reqId } });
      // Only the requester can cancel; don't reveal whether someone else's request exists.
      if (!req || req.userId !== user.id) throw new UserError("Leave request not found.");
      if (!canCancel({ status: req.status, start: dbDateToKey(req.startDate) }, today)) {
        throw new UserError("This request can no longer be cancelled.");
      }
      const { count } = await tx.leaveRequest.updateMany({
        where: { id: req.id, status: req.status },
        data: { status: "CANCELLED" },
      });
      if (count === 0) throw new UserError("This request was just updated. Please refresh and try again.");

      if (req.status === "APPROVED") {
        // Give the days back.
        await tx.leaveBalance.update({
          where: { userId_leaveTypeId_year: { userId: req.userId, leaveTypeId: req.leaveTypeId, year: req.startDate.getUTCFullYear() } },
          data: { used: { decrement: req.days } },
        });
      }
      await writeAudit(tx, {
        actorId: user.id,
        action: "LEAVE_CANCELLED",
        entityType: "LeaveRequest",
        entityId: req.id,
        details: { previousStatus: req.status, days: req.days },
      });
    });

    revalidatePath("/", "layout");
    return { ok: true, message: "Leave request cancelled." };
  });
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
});

export type DecideLeaveInput = z.input<typeof decideSchema>;

export async function decideLeaveAction(input: DecideLeaveInput): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await assertUser("MANAGER", "ADMIN");
    const data = parseInput(decideSchema, input);
    const note = data.note ? data.note : null;
    if (data.decision === "REJECT" && !note) {
      throw new UserError("A note is required when rejecting a request.", { note: "Please explain why this request is rejected." });
    }

    const message = await db.$transaction(async (tx) => {
      const req = await tx.leaveRequest.findUnique({
        where: { id: data.id },
        include: { user: { select: { id: true, name: true, manager: { select: { id: true, role: true, isActive: true } } } } },
      });
      if (!req) throw new UserError("Leave request not found.");
      if (!canDecide({ id: actor.id, role: actor.role }, req.userId, req.user.manager)) {
        throw new UserError(req.userId === actor.id ? "You can't approve or reject your own request." : "You can't act on this request.");
      }
      if (req.status !== "PENDING") throw new UserError(`This request has already been ${req.status.toLowerCase()}.`);

      const year = req.startDate.getUTCFullYear();
      if (data.decision === "APPROVE") {
        await ensureBalances(req.userId, year, tx);
        const balance = await lockBalance(tx, req.userId, req.leaveTypeId, year);
        if (!canApproveWithBalance(balance, req.days)) {
          const left = balance ? Math.max(0, balance.allocated - balance.used) : 0;
          throw new UserError(
            `Can't approve: ${req.user.name} has only ${left} day${left === 1 ? "" : "s"} left of this leave type, but the request needs ${req.days}.`,
          );
        }
      }

      // Guard against double clicks / two approvers at once: only update if still PENDING.
      const { count } = await tx.leaveRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: {
          status: data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          decidedById: actor.id,
          decisionNote: note,
          decidedAt: new Date(),
        },
      });
      if (count === 0) throw new UserError("This request has already been decided.");

      if (data.decision === "APPROVE") {
        await tx.leaveBalance.update({
          where: { userId_leaveTypeId_year: { userId: req.userId, leaveTypeId: req.leaveTypeId, year } },
          data: { used: { increment: req.days } },
        });
      }
      await writeAudit(tx, {
        actorId: actor.id,
        action: data.decision === "APPROVE" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        entityType: "LeaveRequest",
        entityId: req.id,
        details: { employee: req.user.name, days: req.days, note },
      });
      return data.decision === "APPROVE" ? `Approved ${req.user.name}'s leave.` : `Rejected ${req.user.name}'s leave.`;
    });

    revalidatePath("/", "layout");
    return { ok: true, message };
  });
}
