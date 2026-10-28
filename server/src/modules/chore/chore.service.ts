import { Prisma, ChoreAssignmentStatus, ChoreSkipMode, ChoreStatus } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { localDateString, localMidnight } from "../../utils/timezone";
import { withChores } from "./chore.access";
import type { ChoreContext } from "./chore.access";
import { catchUpChore, skipTurn, slotFrom, startNextTurn, unfreeze } from "./chore.engine";
import { splitOrder } from "./chore.schedule";
import {
  assertChoreNotArchived,
  checklistSelect,
  choreSummarySelect,
  findChore,
  getChoreDetail,
  getUpcoming,
  loadParticipants,
  openCycle,
  participantSelect,
  pauseSelect,
  toChoreSummary,
  toCycle,
  writeQueue,
} from "./chore.shared";
import type {
  AddParticipantInput,
  CreateChoreInput,
  ListChoresQuery,
  ListPausesQuery,
  MoveInput,
  OptionalReasonInput,
  RemoveParticipantQuery,
  ReorderQueueInput,
  ReplaceChecklistInput,
  SetAvailabilityInput,
  SwapInput,
  UpdateChoreInput,
} from "./chore.validation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const detail = (ctx: ChoreContext, choreId: string, upcoming?: number) =>
  getChoreDetail(ctx.tx, choreId, ctx.timezone, ctx.now, upcoming);

async function summary(ctx: ChoreContext, choreId: string) {
  const row = await ctx.tx.chore.findUniqueOrThrow({
    where: { id: choreId },
    select: choreSummarySelect,
  });
  return toChoreSummary(row, ctx.now);
}

async function activeSummaries(ctx: ChoreContext) {
  const rows = await ctx.tx.chore.findMany({
    where: { groupId: ctx.groupId, status: { not: ChoreStatus.ARCHIVED } },
    orderBy: { createdAt: "asc" },
    select: choreSummarySelect,
  });
  return rows.map((r) => toChoreSummary(r, ctx.now));
}

async function requireGroupMember(ctx: ChoreContext, userId: string) {
  const member = await ctx.tx.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: ctx.groupId } },
    select: { id: true },
  });
  if (!member) {
    throw new AppError(400, "User is not a member of this group");
  }
}

async function requireParticipant(ctx: ChoreContext, choreId: string, userId: string) {
  const participant = await ctx.tx.choreParticipant.findUnique({
    where: { choreId_userId: { choreId, userId } },
    select: { removedAt: true },
  });
  if (!participant || participant.removedAt) {
    throw new AppError(404, "Participant not found");
  }
}

function assertFuture(date: Date | null | undefined, now: Date) {
  if (date && date <= now) {
    throw new AppError(400, "unavailableUntil must be in the future");
  }
}

function insertAt<T>(list: T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)];
}

/** Open cycle of a chore whose current-cycle queue may be edited. */
async function editableCycle(ctx: ChoreContext, choreId: string) {
  const chore = await findChore(ctx.tx, ctx.groupId, choreId);
  if (chore.status !== ChoreStatus.ACTIVE && chore.status !== ChoreStatus.PAUSED) {
    throw new AppError(409, `Queue cannot be changed while the chore is ${chore.status}`);
  }
  return requireFound(await openCycle(ctx.tx, choreId), "Cycle not found");
}

function assertPendingInCycle(cycle: { order: string[]; locked: Set<string> }, userId: string) {
  if (!cycle.order.includes(userId)) {
    throw new AppError(400, "User is not in the current cycle");
  }
  if (cycle.locked.has(userId)) {
    throw new AppError(409, "Member already had or is having their turn in this cycle");
  }
}

async function cycleResponse(ctx: ChoreContext, choreId: string) {
  const cycle = requireFound(await openCycle(ctx.tx, choreId), "Cycle not found");
  return {
    cycle: toCycle(cycle),
    upcoming: await getUpcoming(ctx.tx, choreId, ctx.timezone, 10),
  };
}

// ─── Chores ───────────────────────────────────────────────────────────────────

/** Creates a chore with its original queue, checklist, first cycle and first turn. */
export function createChore(userId: string, groupId: string, input: CreateChoreInput) {
  return withChores(userId, groupId, { owner: "create chores" }, async (ctx) => {
    const { tx, timezone, now } = ctx;
    const members = await tx.groupMember.findMany({
      where: { groupId, userId: { in: input.participantIds } },
      select: { userId: true },
    });
    if (members.length !== input.participantIds.length) {
      throw new AppError(400, "Every participant must be a member of this group");
    }

    const today = localDateString(now, timezone);
    const startDate = input.startDate ?? today;
    if (startDate < today) {
      throw new AppError(400, "startDate cannot be in the past");
    }

    const chore = await tx.chore.create({
      data: {
        groupId,
        name: input.name,
        description: input.description,
        intervalDays: input.intervalDays,
        deadlineMinutes: input.deadlineTime,
        finePerMember: input.finePerMember,
        createdById: userId,
        // Born frozen while a group-wide pause is active.
        frozenAt: ctx.choresPausedAt ? now : null,
        participants: {
          create: input.participantIds.map((id, position) => ({ userId: id, position })),
        },
        checklist: {
          create: (input.checklist ?? []).map((label, position) => ({ label, position })),
        },
        cycles: { create: { number: 1, order: input.participantIds } },
      },
      select: {
        id: true,
        status: true,
        currentAssignmentId: true,
        intervalDays: true,
        deadlineMinutes: true,
      },
    });

    await startNextTurn(tx, chore, slotFrom(localMidnight(startDate, timezone), chore, timezone));
    return detail(ctx, chore.id);
  });
}

export function listChores(userId: string, groupId: string, query: ListChoresQuery) {
  return withChores(userId, groupId, {}, async (ctx) => {
    const rows = await ctx.tx.chore.findMany({
      where: {
        groupId,
        status: query.status ?? { not: ChoreStatus.ARCHIVED },
      },
      orderBy: { createdAt: "asc" },
      select: choreSummarySelect,
    });
    return {
      chores: rows.map((r) => toChoreSummary(r, ctx.now)),
      groupPausedAt: ctx.choresPausedAt,
    };
  });
}

export function getChore(userId: string, groupId: string, choreId: string, upcoming: number) {
  return withChores(userId, groupId, {}, async (ctx) => {
    await findChore(ctx.tx, groupId, choreId);
    return detail(ctx, choreId, upcoming);
  });
}

/** Edits settings; interval, deadline and fine changes only affect what is created afterwards. */
export function updateChore(
  userId: string,
  groupId: string,
  choreId: string,
  input: UpdateChoreInput,
) {
  return withChores(userId, groupId, { owner: "edit chores" }, async (ctx) => {
    assertChoreNotArchived(await findChore(ctx.tx, groupId, choreId));
    await ctx.tx.chore.update({
      where: { id: choreId },
      data: {
        name: input.name,
        description: input.description,
        intervalDays: input.intervalDays,
        deadlineMinutes: input.deadlineTime,
        finePerMember: input.finePerMember,
      },
    });
    return detail(ctx, choreId);
  });
}

/**
 * Stops the rotation by freezing it like a pause: the open cycle and current
 * turn are kept so a restore continues where it stopped. Open assignments
 * can still be submitted and reviewed; frozen deadlines are not fined.
 */
export function archiveChore(
  userId: string,
  groupId: string,
  choreId: string,
  input: OptionalReasonInput,
) {
  return withChores(userId, groupId, { owner: "archive chores" }, async (ctx) => {
    const { tx, now } = ctx;
    const chore = await findChore(tx, groupId, choreId);
    if (chore.status === ChoreStatus.ARCHIVED) {
      throw new AppError(409, "Chore is already archived");
    }

    // A paused chore keeps its earlier frozenAt, so restore shifts by the whole stop.
    await tx.chorePause.updateMany({
      where: { choreId, resumedAt: null },
      data: { resumedAt: now, resumedById: userId, resumeReason: input.reason ?? "Chore archived" },
    });
    await tx.chore.update({
      where: { id: choreId },
      data: { status: ChoreStatus.ARCHIVED, frozenAt: chore.frozenAt ?? now },
    });
    return summary(ctx, choreId);
  });
}

/**
 * Undoes an archive: the frozen turn continues with the time it had left.
 * Chores archived before freezing existed have no open cycle and start a fresh one.
 */
export function restoreChore(userId: string, groupId: string, choreId: string) {
  return withChores(userId, groupId, { owner: "restore chores" }, async (ctx) => {
    const { tx, now } = ctx;
    const chore = await findChore(tx, groupId, choreId);
    if (chore.status !== ChoreStatus.ARCHIVED) {
      throw new AppError(409, "Chore is not archived");
    }

    // Under a group-wide pause it stays frozen; resume-all unfreezes it.
    await tx.chore.update({
      where: { id: choreId },
      data: {
        status: ChoreStatus.ACTIVE,
        ...(ctx.choresPausedAt && !chore.frozenAt ? { frozenAt: now } : {}),
      },
    });
    if (!ctx.choresPausedAt) {
      await unfreeze(tx, chore, now);
      await catchUpChore(tx, choreId, ctx.timezone, now);
    }
    return summary(ctx, choreId);
  });
}

// ─── Participants ─────────────────────────────────────────────────────────────

/** Adds a group member to the chore or re-adds a removed one (history kept). */
export function addParticipant(
  userId: string,
  groupId: string,
  choreId: string,
  input: AddParticipantInput,
) {
  return withChores(userId, groupId, { owner: "manage participants" }, async (ctx) => {
    const { tx } = ctx;
    assertChoreNotArchived(await findChore(tx, groupId, choreId));
    await requireGroupMember(ctx, input.userId);

    const existing = await tx.choreParticipant.findUnique({
      where: { choreId_userId: { choreId, userId: input.userId } },
      select: { removedAt: true },
    });
    if (existing && !existing.removedAt) {
      throw new AppError(409, "User is already a participant of this chore");
    }

    const { originalQueue } = await loadParticipants(tx, choreId);
    const position = input.position ?? originalQueue.length;
    if (position > originalQueue.length) {
      throw new AppError(400, "position is out of range");
    }

    const cycle = await openCycle(tx, choreId);
    let cycleOrder: string[] | undefined;
    if (cycle && !cycle.locked.has(input.userId)) {
      const order = cycle.order.filter((u) => u !== input.userId);
      const lockedCount = splitOrder(order, cycle.locked).locked.length;
      const cyclePosition = input.cyclePosition ?? order.length;
      if (cyclePosition < lockedCount || cyclePosition > order.length) {
        throw new AppError(400, `cyclePosition must be between ${lockedCount} and ${order.length}`);
      }
      cycleOrder = insertAt(order, cyclePosition, input.userId);
    }
    // A re-added member who already took a turn this cycle stays locked; no second turn.

    await tx.choreParticipant.upsert({
      where: { choreId_userId: { choreId, userId: input.userId } },
      create: { choreId, userId: input.userId, position },
      update: { removedAt: null, unavailableUntil: null, unavailableReason: null },
    });
    await writeQueue(tx, choreId, insertAt(originalQueue, position, input.userId));
    if (cycle && cycleOrder) {
      await tx.choreCycle.update({ where: { id: cycle.id }, data: { order: cycleOrder } });
    }

    // Restarts the rotation if it was stalled.
    await catchUpChore(tx, choreId, ctx.timezone, ctx.now);
    return detail(ctx, choreId);
  });
}

/** Removes a member from future turns of this chore only. */
export function removeParticipant(
  userId: string,
  groupId: string,
  choreId: string,
  targetId: string,
  query: RemoveParticipantQuery,
) {
  return withChores(userId, groupId, { owner: "manage participants" }, async (ctx) => {
    const { tx, now } = ctx;
    const chore = await findChore(tx, groupId, choreId);
    await requireParticipant(ctx, choreId, targetId);

    const current = chore.currentAssignmentId
      ? await tx.choreAssignment.findUniqueOrThrow({
          where: { id: chore.currentAssignmentId },
          select: { id: true, userId: true, status: true, endsAt: true, deadlineAt: true },
        })
      : null;
    const holdsTurn = current?.userId === targetId;
    if (holdsTurn && !query.currentTurn) {
      throw new AppError(
        409,
        "Member holds the current turn: pass currentTurn=reassign or currentTurn=keep",
      );
    }

    await tx.choreParticipant.update({
      where: { choreId_userId: { choreId, userId: targetId } },
      data: { removedAt: now },
    });
    const { originalQueue } = await loadParticipants(tx, choreId);
    await writeQueue(tx, choreId, originalQueue);

    const cycle = await openCycle(tx, choreId);
    if (cycle && !cycle.locked.has(targetId)) {
      await tx.choreCycle.update({
        where: { id: cycle.id },
        data: { order: cycle.order.filter((u) => u !== targetId) },
      });
    }

    if (
      current &&
      holdsTurn &&
      query.currentTurn === "reassign" &&
      current.status === ChoreAssignmentStatus.PENDING
    ) {
      await skipTurn(tx, chore, current, {
        by: userId,
        reason: "Removed from the chore",
        mode: ChoreSkipMode.FORFEIT,
        now,
      });
    }
    return detail(ctx, choreId);
  });
}

/** Marks a participant away until a time (or available again with null). */
export function setAvailability(
  userId: string,
  groupId: string,
  choreId: string,
  targetId: string,
  input: SetAvailabilityInput,
) {
  return withChores(userId, groupId, { owner: "manage participants" }, async (ctx) => {
    const { tx } = ctx;
    await findChore(tx, groupId, choreId);
    await requireParticipant(ctx, choreId, targetId);
    assertFuture(input.unavailableUntil, ctx.now);

    await tx.choreParticipant.update({
      where: { choreId_userId: { choreId, userId: targetId } },
      data: {
        unavailableUntil: input.unavailableUntil,
        unavailableReason: input.unavailableUntil ? (input.reason ?? null) : null,
      },
    });
    // A member becoming available can restart a stalled chore.
    await catchUpChore(tx, choreId, ctx.timezone, ctx.now);

    const participant = await tx.choreParticipant.findUniqueOrThrow({
      where: { choreId_userId: { choreId, userId: targetId } },
      select: participantSelect,
    });
    return { participant };
  });
}

// ─── Queues ───────────────────────────────────────────────────────────────────

/** Sets the permanent order; it applies from the next cycle. */
export function reorderOriginalQueue(
  userId: string,
  groupId: string,
  choreId: string,
  input: ReorderQueueInput,
) {
  return withChores(userId, groupId, { owner: "reorder queues" }, async (ctx) => {
    assertChoreNotArchived(await findChore(ctx.tx, groupId, choreId));
    const { originalQueue } = await loadParticipants(ctx.tx, choreId);
    const active = new Set(originalQueue);
    if (input.order.length !== active.size || !input.order.every((u) => active.has(u))) {
      throw new AppError(400, "order must contain every active participant exactly once");
    }
    await writeQueue(ctx.tx, choreId, input.order);
    return detail(ctx, choreId);
  });
}

/** Exchanges the current-cycle positions of two pending members. */
export function swapInCycle(userId: string, groupId: string, choreId: string, input: SwapInput) {
  return withChores(userId, groupId, { owner: "reorder queues" }, async (ctx) => {
    const cycle = await editableCycle(ctx, choreId);
    assertPendingInCycle(cycle, input.userIdA);
    assertPendingInCycle(cycle, input.userIdB);

    const order = cycle.order.map((u) =>
      u === input.userIdA ? input.userIdB : u === input.userIdB ? input.userIdA : u,
    );
    await ctx.tx.choreCycle.update({ where: { id: cycle.id }, data: { order } });
    return cycleResponse(ctx, choreId);
  });
}

/** Moves one pending member to a new index of the current cycle. */
export function moveInCycle(userId: string, groupId: string, choreId: string, input: MoveInput) {
  return withChores(userId, groupId, { owner: "reorder queues" }, async (ctx) => {
    const cycle = await editableCycle(ctx, choreId);
    assertPendingInCycle(cycle, input.userId);

    const lockedCount = toCycle(cycle).lockedCount;
    if (input.toIndex < lockedCount) {
      throw new AppError(409, "Cannot move a member ahead of members who already had their turn");
    }
    if (input.toIndex >= cycle.order.length) {
      throw new AppError(400, "toIndex is out of range");
    }

    const order = insertAt(
      cycle.order.filter((u) => u !== input.userId),
      input.toIndex,
      input.userId,
    );
    await ctx.tx.choreCycle.update({ where: { id: cycle.id }, data: { order } });
    return cycleResponse(ctx, choreId);
  });
}

// ─── Checklist ────────────────────────────────────────────────────────────────

/** Replaces the active checklist; omitted items are archived, never deleted. */
export function replaceChecklist(
  userId: string,
  groupId: string,
  choreId: string,
  input: ReplaceChecklistInput,
) {
  return withChores(userId, groupId, { owner: "manage the checklist" }, async (ctx) => {
    const { tx, now } = ctx;
    assertChoreNotArchived(await findChore(tx, groupId, choreId));

    const active = await tx.choreChecklistItem.findMany({
      where: { choreId, archivedAt: null },
      select: { id: true },
    });
    const activeIds = new Set(active.map((i) => i.id));
    const keptIds = input.items.flatMap((i) => (i.id ? [i.id] : []));
    if (new Set(keptIds).size !== keptIds.length) {
      throw new AppError(400, "Duplicate checklist item id");
    }
    const unknown = keptIds.find((id) => !activeIds.has(id));
    if (unknown) {
      throw new AppError(400, `Unknown checklist item: ${unknown}`);
    }

    await tx.choreChecklistItem.updateMany({
      where: { choreId, archivedAt: null, id: { notIn: keptIds } },
      data: { archivedAt: now },
    });
    for (const [position, item] of input.items.entries()) {
      if (item.id) {
        await tx.choreChecklistItem.update({
          where: { id: item.id },
          data: { label: item.label, position },
        });
      } else {
        await tx.choreChecklistItem.create({ data: { choreId, label: item.label, position } });
      }
    }

    const checklist = await tx.choreChecklistItem.findMany({
      where: { choreId, archivedAt: null },
      orderBy: { position: "asc" },
      select: checklistSelect,
    });
    return { checklist };
  });
}

// ─── Pause / resume ───────────────────────────────────────────────────────────

export function pauseChore(
  userId: string,
  groupId: string,
  choreId: string,
  input: OptionalReasonInput,
) {
  return withChores(userId, groupId, { owner: "pause chores" }, async (ctx) => {
    const { tx, now } = ctx;
    const chore = await findChore(tx, groupId, choreId);
    assertChoreNotArchived(chore);
    if (chore.status === ChoreStatus.PAUSED) {
      throw new AppError(409, "Chore is already paused");
    }

    await tx.chore.update({
      where: { id: choreId },
      data: { status: ChoreStatus.PAUSED, frozenAt: chore.frozenAt ?? now },
    });
    await tx.chorePause.create({
      data: { groupId, choreId, pausedById: userId, pausedAt: now, reason: input.reason },
    });
    return summary(ctx, choreId);
  });
}

/** Back to ACTIVE; the clock stays frozen while a group-wide pause is active. */
export function resumeChore(
  userId: string,
  groupId: string,
  choreId: string,
  input: OptionalReasonInput,
) {
  return withChores(userId, groupId, { owner: "resume chores" }, async (ctx) => {
    const { tx, now } = ctx;
    const chore = await findChore(tx, groupId, choreId);
    if (chore.status !== ChoreStatus.PAUSED) {
      throw new AppError(409, "Chore is not paused");
    }

    await tx.chorePause.updateMany({
      where: { choreId, resumedAt: null },
      data: { resumedAt: now, resumedById: userId, resumeReason: input.reason },
    });
    await tx.chore.update({ where: { id: choreId }, data: { status: ChoreStatus.ACTIVE } });
    if (!ctx.choresPausedAt) {
      await unfreeze(tx, chore, now);
      await catchUpChore(tx, choreId, ctx.timezone, now);
    }
    return summary(ctx, choreId);
  });
}

export function pauseAll(userId: string, groupId: string, input: OptionalReasonInput) {
  return withChores(userId, groupId, { owner: "pause chores" }, async (ctx) => {
    const { tx, now } = ctx;
    if (ctx.choresPausedAt) {
      throw new AppError(409, "A group-wide pause is already active");
    }

    await tx.group.update({ where: { id: groupId }, data: { choresPausedAt: now } });
    await tx.chore.updateMany({
      where: { groupId, status: { not: ChoreStatus.ARCHIVED }, frozenAt: null },
      data: { frozenAt: now },
    });
    await tx.chorePause.create({
      data: { groupId, choreId: null, pausedById: userId, pausedAt: now, reason: input.reason },
    });
    return { chores: await activeSummaries(ctx), groupPausedAt: now };
  });
}

/** Ends the group-wide pause; individually paused chores stay paused. */
export function resumeAll(userId: string, groupId: string, input: OptionalReasonInput) {
  return withChores(userId, groupId, { owner: "resume chores" }, async (ctx) => {
    const { tx, now } = ctx;
    if (!ctx.choresPausedAt) {
      throw new AppError(409, "No group-wide pause is active");
    }

    await tx.group.update({ where: { id: groupId }, data: { choresPausedAt: null } });
    await tx.chorePause.updateMany({
      where: { groupId, choreId: null, resumedAt: null },
      data: { resumedAt: now, resumedById: userId, resumeReason: input.reason },
    });

    const frozen = await tx.chore.findMany({
      where: {
        groupId,
        status: { notIn: [ChoreStatus.ARCHIVED, ChoreStatus.PAUSED] },
        frozenAt: { not: null },
      },
      select: { id: true, frozenAt: true, currentAssignmentId: true },
    });
    for (const chore of frozen) {
      await unfreeze(tx, chore, now);
      await catchUpChore(tx, chore.id, ctx.timezone, now);
    }
    return { chores: await activeSummaries(ctx), groupPausedAt: null };
  });
}

export function listPauses(userId: string, groupId: string, query: ListPausesQuery) {
  return withChores(userId, groupId, {}, async ({ tx }) => {
    const where: Prisma.ChorePauseWhereInput = {
      groupId,
      ...(query.groupWide ? { choreId: null } : query.choreId ? { choreId: query.choreId } : {}),
    };
    const pauses = await tx.chorePause.findMany({
      where,
      orderBy: [{ pausedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: pauseSelect,
    });
    const total = await tx.chorePause.count({ where });
    return { pauses, total, page: query.page, limit: query.limit };
  });
}
