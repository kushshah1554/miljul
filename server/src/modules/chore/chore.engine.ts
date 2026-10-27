import {
  Prisma,
  ChoreAssignmentStatus,
  ChoreFineReason,
  ChoreSkipMode,
  ChoreStatus,
} from "../../generated/prisma/client";
import { prisma } from "../../utils/prisma";
import { runSerializable } from "../../utils/transaction";
import { addLocalDays, nextLocalTime, startOfLocalDay } from "../../utils/timezone";
import { isAvailable, promote, splitOrder } from "./chore.schedule";
import { choreStateSelect, fineSelect, loadParticipants, openCycle } from "./chore.shared";

type Tx = Prisma.TransactionClient;

type Slot = { startsAt: Date; endsAt: Date; deadlineAt: Date };

// Guards against a runaway loop when a chore was left untouched for years.
const MAX_CATCH_UP_TURNS = 1000;

export function slotFrom(
  startsAt: Date,
  chore: { intervalDays: number; deadlineMinutes: number },
  timezone: string,
): Slot {
  const endsAt = addLocalDays(startsAt, chore.intervalDays, timezone);
  return { startsAt, endsAt, deadlineAt: nextLocalTime(endsAt, chore.deadlineMinutes, timezone) };
}

/**
 * Gives `slot` to the next eligible pending member of the open cycle. When
 * nobody pending is available the cycle ends (they miss it) and a fresh one
 * starts from the original queue. With nobody available at all the chore
 * stalls as NEEDS_ATTENTION. Returns the new assignment id, or null.
 */
export async function startNextTurn(
  tx: Tx,
  chore: { id: string; status: ChoreStatus; currentAssignmentId: string | null },
  slot: Slot,
  exclude?: string,
): Promise<string | null> {
  const { originalQueue, availability } = await loadParticipants(tx, chore.id);
  let cycle = await openCycle(tx, chore.id);
  const pick = (c: { order: string[]; locked: Set<string> }) =>
    splitOrder(c.order, c.locked).pending.find(
      (u) => u !== exclude && isAvailable(availability, u, slot.startsAt),
    );

  let userId = cycle ? pick(cycle) : undefined;

  if (!userId) {
    if (!cycle || cycle.turns > 0) {
      if (cycle) {
        await tx.choreCycle.update({ where: { id: cycle.id }, data: { endedAt: slot.startsAt } });
      }
      const created = await tx.choreCycle.create({
        data: {
          choreId: chore.id,
          number: (cycle?.number ?? 0) + 1,
          order: originalQueue,
          startedAt: slot.startsAt,
        },
        select: { id: true, number: true, order: true, startedAt: true, endedAt: true },
      });
      cycle = { ...created, turns: 0, locked: new Set() };
    } else if (cycle.order.join() !== originalQueue.join()) {
      // An untouched cycle (stalled chore) follows the latest original queue.
      await tx.choreCycle.update({ where: { id: cycle.id }, data: { order: originalQueue } });
      cycle = { ...cycle, order: originalQueue };
    }
    userId = pick(cycle);
  }

  if (!userId || !cycle) {
    const status = chore.status === ChoreStatus.PAUSED ? ChoreStatus.PAUSED : ChoreStatus.NEEDS_ATTENTION;
    if (chore.status !== status || chore.currentAssignmentId) {
      await tx.chore.update({ where: { id: chore.id }, data: { status, currentAssignmentId: null } });
    }
    return null;
  }

  await tx.choreCycle.update({
    where: { id: cycle.id },
    data: { order: promote(cycle.order, cycle.locked, userId) },
  });
  const assignment = await tx.choreAssignment.create({
    data: { choreId: chore.id, cycleId: cycle.id, userId, ...slot },
    select: { id: true },
  });
  await tx.chore.update({
    where: { id: chore.id },
    data: {
      currentAssignmentId: assignment.id,
      ...(chore.status === ChoreStatus.NEEDS_ATTENTION ? { status: ChoreStatus.ACTIVE } : {}),
    },
  });
  return assignment.id;
}

/** Advances ended rotations of one chore, or restarts it when stalled. */
export async function catchUpChore(tx: Tx, choreId: string, timezone: string, now: Date) {
  const chore = await tx.chore.findUniqueOrThrow({ where: { id: choreId }, select: choreStateSelect });
  if (chore.status === ChoreStatus.ARCHIVED || chore.frozenAt) return;

  let current = chore.currentAssignmentId
    ? await tx.choreAssignment.findUniqueOrThrow({
        where: { id: chore.currentAssignmentId },
        select: { id: true, endsAt: true },
      })
    : null;

  if (!current) {
    // Restart now; the turn still ends on a local-midnight boundary.
    const endsAt = addLocalDays(startOfLocalDay(now, timezone), chore.intervalDays, timezone);
    const slot = { startsAt: now, endsAt, deadlineAt: nextLocalTime(endsAt, chore.deadlineMinutes, timezone) };
    const id = await startNextTurn(tx, chore, slot);
    if (!id) return;
    current = { id, endsAt };
  }

  for (let i = 0; i < MAX_CATCH_UP_TURNS && current.endsAt <= now; i += 1) {
    const slot = slotFrom(current.endsAt, chore, timezone);
    const id = await startNextTurn(
      tx,
      { id: chore.id, status: ChoreStatus.ACTIVE, currentAssignmentId: current.id },
      slot,
    );
    if (!id) return;
    current = { id, endsAt: slot.endsAt };
  }
}

/**
 * Creates the single fine of an assignment. Recipients are the group's
 * members (minus the payer) right now; amounts never change afterwards.
 */
export async function createFine(
  tx: Tx,
  groupId: string,
  assignment: { id: string; userId: string },
  reason: ChoreFineReason,
  finePerMember: Prisma.Decimal,
) {
  const recipients = await tx.groupMember.findMany({
    where: { groupId, userId: { not: assignment.userId } },
    select: { userId: true },
  });
  return tx.choreFine.create({
    data: {
      assignmentId: assignment.id,
      payerId: assignment.userId,
      reasons: [reason],
      shares: {
        create: recipients.map((r) => ({ recipientId: r.userId, amount: finePerMember })),
      },
    },
    select: fineSelect,
  });
}

/** Records OVERDUE fines; a frozen chore's clock stopped at frozenAt. */
async function recordOverdueFines(tx: Tx, groupId: string, now: Date) {
  const due = await tx.choreAssignment.findMany({
    where: {
      status: ChoreAssignmentStatus.PENDING,
      fine: null,
      deadlineAt: { lt: now },
      chore: { groupId },
    },
    select: {
      id: true,
      userId: true,
      deadlineAt: true,
      chore: { select: { finePerMember: true, frozenAt: true } },
    },
  });
  for (const a of due) {
    if (a.chore.frozenAt && a.deadlineAt >= a.chore.frozenAt) continue;
    await createFine(tx, groupId, a, ChoreFineReason.OVERDUE, a.chore.finePerMember);
  }
}

/** Brings every chore of a group up to date. Idempotent. */
export async function catchUpGroup(tx: Tx, groupId: string, timezone: string, now: Date) {
  const chores = await tx.chore.findMany({
    where: { groupId, status: { not: ChoreStatus.ARCHIVED }, frozenAt: null },
    select: { id: true },
  });
  for (const chore of chores) {
    await catchUpChore(tx, chore.id, timezone, now);
  }
  await recordOverdueFines(tx, groupId, now);
}

/** Background job body: catch up every active group that has chores. */
export async function catchUpAllGroups() {
  const groups = await prisma.group.findMany({
    where: { isArchived: false, chores: { some: {} } },
    select: { id: true, timezone: true },
  });
  for (const group of groups) {
    try {
      await runSerializable((tx) => catchUpGroup(tx, group.id, group.timezone, new Date()));
    } catch (error) {
      console.log("chore catch-up failed for group", group.id, error);
    }
  }
}

/**
 * Skips the current turn: the assignment becomes SKIPPED and the next
 * eligible member (never the skipped one) takes over the same endsAt and
 * deadlineAt. Returns the takeover assignment id, or null when stalled.
 */
export async function skipTurn(
  tx: Tx,
  chore: { id: string; status: ChoreStatus },
  assignment: { id: string; userId: string; endsAt: Date; deadlineAt: Date },
  input: { by: string; reason: string; mode: ChoreSkipMode; now: Date },
): Promise<string | null> {
  await tx.choreAssignment.update({
    where: { id: assignment.id },
    data: {
      status: ChoreAssignmentStatus.SKIPPED,
      skipMode: input.mode,
      closedById: input.by,
      closedAt: input.now,
      closeReason: input.reason,
    },
  });

  if (input.mode === ChoreSkipMode.DEFER) {
    const cycle = await openCycle(tx, chore.id);
    if (cycle) {
      const order = [...cycle.order.filter((u) => u !== assignment.userId), assignment.userId];
      await tx.choreCycle.update({ where: { id: cycle.id }, data: { order } });
    }
  }

  const takeoverId = await startNextTurn(
    tx,
    { id: chore.id, status: chore.status, currentAssignmentId: assignment.id },
    { startsAt: input.now, endsAt: assignment.endsAt, deadlineAt: assignment.deadlineAt },
    assignment.userId,
  );
  if (takeoverId) {
    await tx.choreAssignment.update({
      where: { id: assignment.id },
      data: { replacedById: takeoverId },
    });
  }
  return takeoverId;
}

/**
 * Restarts a frozen chore's clock: the current turn's end and every
 * deadline not yet passed when it froze move forward by the frozen time.
 */
export async function unfreeze(
  tx: Tx,
  chore: { id: string; frozenAt: Date | null; currentAssignmentId: string | null },
  now: Date,
) {
  if (!chore.frozenAt) return;
  const shift = now.getTime() - chore.frozenAt.getTime();
  const rows = await tx.choreAssignment.findMany({
    where: {
      choreId: chore.id,
      OR: [
        { deadlineAt: { gte: chore.frozenAt } },
        ...(chore.currentAssignmentId ? [{ id: chore.currentAssignmentId }] : []),
      ],
    },
    select: { id: true, endsAt: true, deadlineAt: true },
  });
  for (const row of rows) {
    await tx.choreAssignment.update({
      where: { id: row.id },
      data: {
        ...(row.deadlineAt >= chore.frozenAt
          ? { deadlineAt: new Date(row.deadlineAt.getTime() + shift) }
          : {}),
        ...(row.id === chore.currentAssignmentId
          ? { endsAt: new Date(row.endsAt.getTime() + shift) }
          : {}),
      },
    });
  }
  await tx.chore.update({ where: { id: chore.id }, data: { frozenAt: null } });
}
