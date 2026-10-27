import {
  Prisma,
  ChoreAssignmentStatus,
  ChoreFineReason,
  ChoreFineStatus,
  ChoreReviewDecision,
  GroupRole,
} from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { withChores } from "../chore/chore.access";
import type { ChoreContext } from "../chore/chore.access";
import { createFine, skipTurn } from "../chore/chore.engine";
import {
  assignmentSelect,
  checklistSelect,
  choreSummarySelect,
  findChore,
  fineSelect,
  reviewSelect,
  toAssignment,
  toChoreSummary,
  toFine,
} from "../chore/chore.shared";
import type {
  ListAssignmentsQuery,
  MyAssignmentsQuery,
  ReviewInput,
  SkipInput,
  SkipRequestInput,
  SubmitInput,
  WaiveInput,
} from "./chore-assignment.validation";

const OPEN_STATUSES = [ChoreAssignmentStatus.PENDING, ChoreAssignmentStatus.SUBMITTED];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Loads the chore (scoped to the group) and one of its assignments; 404 otherwise. */
async function findAssignment(ctx: ChoreContext, choreId: string, assignmentId: string) {
  const chore = await findChore(ctx.tx, ctx.groupId, choreId);
  const assignment = await ctx.tx.choreAssignment.findFirst({
    where: { id: assignmentId, choreId },
    select: {
      id: true,
      userId: true,
      status: true,
      endsAt: true,
      deadlineAt: true,
      skipRequestedAt: true,
    },
  });
  return { chore, assignment: requireFound(assignment, "Assignment not found") };
}

async function loadAssignment(ctx: ChoreContext, assignmentId: string) {
  const row = await ctx.tx.choreAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    select: assignmentSelect,
  });
  return toAssignment(row, ctx.now);
}

async function loadFine(ctx: ChoreContext, assignmentId: string) {
  const fine = await ctx.tx.choreFine.findUnique({ where: { assignmentId }, select: fineSelect });
  return fine ? toFine(fine) : null;
}

function activeChecklist(ctx: ChoreContext, choreId: string) {
  return ctx.tx.choreChecklistItem.findMany({
    where: { choreId, archivedAt: null },
    orderBy: { position: "asc" },
    select: checklistSelect,
  });
}

function assertAssignee(assignment: { userId: string }, userId: string) {
  if (assignment.userId !== userId) {
    throw new AppError(403, "Only the assignee can do this");
  }
}

function assertStatus(
  assignment: { status: ChoreAssignmentStatus },
  allowed: ChoreAssignmentStatus[],
) {
  if (!allowed.includes(assignment.status)) {
    throw new AppError(409, `Assignment is ${assignment.status}`);
  }
}

function paginate(query: { page: number; limit: number }) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Assignment history of one chore, newest first (includes former members). */
export function listChoreAssignments(
  userId: string,
  groupId: string,
  choreId: string,
  query: ListAssignmentsQuery,
) {
  return withChores(userId, groupId, {}, async (ctx) => {
    const chore = await findChore(ctx.tx, groupId, choreId);
    const where: Prisma.ChoreAssignmentWhereInput = {
      choreId,
      userId: query.userId,
      status: query.status,
      ...(query.overdue
        ? {
            AND: [
              { status: ChoreAssignmentStatus.PENDING },
              { deadlineAt: { lt: chore.frozenAt ?? ctx.now } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const rows = await ctx.tx.choreAssignment.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      ...paginate(query),
      select: assignmentSelect,
    });
    const total = await ctx.tx.choreAssignment.count({ where });
    return {
      assignments: rows.map((r) => toAssignment(r, ctx.now)),
      total,
      page: query.page,
      limit: query.limit,
    };
  });
}

/** The caller's assignments across every chore of the group. */
export function listMyAssignments(userId: string, groupId: string, query: MyAssignmentsQuery) {
  return withChores(userId, groupId, {}, async (ctx) => {
    const where: Prisma.ChoreAssignmentWhereInput = {
      userId,
      chore: { groupId },
      ...(query.open ? { status: { in: OPEN_STATUSES } } : {}),
    };
    const rows = await ctx.tx.choreAssignment.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      ...paginate(query),
      select: assignmentSelect,
    });
    const total = await ctx.tx.choreAssignment.count({ where });
    return {
      assignments: rows.map((r) => ({ ...toAssignment(r, ctx.now), choreName: r.chore.name })),
      total,
      page: query.page,
      limit: query.limit,
    };
  });
}

export function getAssignment(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
) {
  return withChores(userId, groupId, {}, async (ctx) => {
    await findAssignment(ctx, choreId, assignmentId);
    const reviews = await ctx.tx.choreReview.findMany({
      where: { assignmentId },
      orderBy: { createdAt: "asc" },
      select: reviewSelect,
    });
    return {
      assignment: await loadAssignment(ctx, assignmentId),
      reviews,
      fine: await loadFine(ctx, assignmentId),
      checklist: await activeChecklist(ctx, choreId),
    };
  });
}

// ─── Assignee actions ─────────────────────────────────────────────────────────

/** Marks work done; allowed after the deadline (an OVERDUE fine stays). */
export function submitAssignment(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
  input: SubmitInput,
) {
  return withChores(userId, groupId, { write: true }, async (ctx) => {
    const { assignment } = await findAssignment(ctx, choreId, assignmentId);
    assertAssignee(assignment, userId);
    assertStatus(assignment, [ChoreAssignmentStatus.PENDING]);

    const first = await ctx.tx.choreAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { firstSubmittedAt: true },
    });
    await ctx.tx.choreAssignment.update({
      where: { id: assignmentId },
      data: {
        status: ChoreAssignmentStatus.SUBMITTED,
        firstSubmittedAt: first.firstSubmittedAt ?? ctx.now,
        submittedAt: ctx.now,
        submissionNote: input.note ?? null,
      },
    });
    return { assignment: await loadAssignment(ctx, assignmentId) };
  });
}

/** Asks the owner to skip the current turn; changes nothing in the rotation. */
export function requestSkip(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
  input: SkipRequestInput,
) {
  return withChores(userId, groupId, { write: true }, async (ctx) => {
    const { chore, assignment } = await findAssignment(ctx, choreId, assignmentId);
    assertAssignee(assignment, userId);
    assertStatus(assignment, [ChoreAssignmentStatus.PENDING]);
    if (chore.currentAssignmentId !== assignmentId) {
      throw new AppError(409, "Only the current turn can be skipped");
    }
    if (assignment.skipRequestedAt) {
      throw new AppError(409, "A skip was already requested");
    }

    await ctx.tx.choreAssignment.update({
      where: { id: assignmentId },
      data: { skipRequestedAt: ctx.now, skipRequestReason: input.reason },
    });
    return { assignment: await loadAssignment(ctx, assignmentId) };
  });
}

// ─── Review ───────────────────────────────────────────────────────────────────

/**
 * First review (SUBMITTED → APPROVED/REJECTED) or re-review (flips the
 * decision). The owner reviews, except their own work, which any other
 * member reviews. A rejection adds QUALITY to the assignment's single fine;
 * approving on re-review removes it and voids a fine left without reasons.
 */
export function reviewAssignment(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
  input: ReviewInput,
) {
  return withChores(userId, groupId, { write: true }, async (ctx) => {
    const { tx } = ctx;
    const { chore, assignment } = await findAssignment(ctx, choreId, assignmentId);

    if (assignment.userId === userId) {
      throw new AppError(403, "You cannot review your own work");
    }
    if (ctx.role !== GroupRole.OWNER) {
      const assignee = await tx.groupMember.findUnique({
        where: { userId_groupId: { userId: assignment.userId, groupId } },
        select: { role: true },
      });
      if (assignee?.role !== GroupRole.OWNER) {
        throw new AppError(403, "Only the group owner can review this assignment");
      }
    }

    assertStatus(assignment, [
      ChoreAssignmentStatus.SUBMITTED,
      ChoreAssignmentStatus.APPROVED,
      ChoreAssignmentStatus.REJECTED,
    ]);
    if (assignment.status === input.decision) {
      throw new AppError(409, `Assignment is already ${input.decision}`);
    }

    const checklist = await activeChecklist(ctx, choreId);
    const labels = new Map(checklist.map((i) => [i.id, i.label]));
    const seen = new Set<string>();
    for (const r of input.results) {
      if (!labels.has(r.itemId)) throw new AppError(400, `Unknown checklist item: ${r.itemId}`);
      if (seen.has(r.itemId)) throw new AppError(400, `Duplicate checklist item: ${r.itemId}`);
      seen.add(r.itemId);
    }
    if (seen.size !== labels.size) {
      throw new AppError(400, "Results must cover every checklist item");
    }

    const review = await tx.choreReview.create({
      data: {
        assignmentId,
        reviewerId: userId,
        decision: input.decision,
        results: input.results.map((r) => ({ ...r, label: labels.get(r.itemId) })),
        feedback: input.feedback ?? null,
      },
      select: reviewSelect,
    });
    await tx.choreAssignment.update({
      where: { id: assignmentId },
      data: { status: input.decision },
    });

    const fine = await tx.choreFine.findUnique({
      where: { assignmentId },
      select: { id: true, reasons: true, status: true, voidedById: true },
    });
    if (input.decision === ChoreReviewDecision.REJECTED) {
      if (!fine) {
        await createFine(tx, groupId, assignment, ChoreFineReason.QUALITY, chore.finePerMember);
      } else if (!fine.reasons.includes(ChoreFineReason.QUALITY)) {
        // Re-activate a fine that an earlier approval voided (never one the owner voided).
        const autoVoided = fine.status === ChoreFineStatus.VOIDED && !fine.voidedById;
        await tx.choreFine.update({
          where: { id: fine.id },
          data: {
            reasons: [...fine.reasons, ChoreFineReason.QUALITY],
            ...(autoVoided ? { status: ChoreFineStatus.ACTIVE, voidReason: null } : {}),
          },
        });
      }
    } else if (fine?.reasons.includes(ChoreFineReason.QUALITY)) {
      const reasons = fine.reasons.filter((r) => r !== ChoreFineReason.QUALITY);
      await tx.choreFine.update({
        where: { id: fine.id },
        data: {
          reasons,
          ...(reasons.length === 0 && fine.status === ChoreFineStatus.ACTIVE
            ? { status: ChoreFineStatus.VOIDED, voidReason: "Approved on re-review" }
            : {}),
        },
      });
    }

    return {
      assignment: await loadAssignment(ctx, assignmentId),
      review,
      fine: await loadFine(ctx, assignmentId),
    };
  });
}

// ─── Owner actions ────────────────────────────────────────────────────────────

/** Skips the current turn; the next eligible member takes over immediately. */
export function skipAssignment(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
  input: SkipInput,
) {
  return withChores(userId, groupId, { owner: "skip assignments" }, async (ctx) => {
    const { tx, now } = ctx;
    const { chore, assignment } = await findAssignment(ctx, choreId, assignmentId);
    if (chore.currentAssignmentId !== assignmentId) {
      throw new AppError(409, "Only the current turn can be skipped");
    }
    assertStatus(assignment, [ChoreAssignmentStatus.PENDING]);
    if (chore.frozenAt) {
      throw new AppError(409, "Chore is paused");
    }
    if (input.unavailableUntil && input.unavailableUntil <= now) {
      throw new AppError(400, "unavailableUntil must be in the future");
    }

    if (input.unavailableUntil) {
      await tx.choreParticipant.updateMany({
        where: { choreId, userId: assignment.userId, removedAt: null },
        data: { unavailableUntil: input.unavailableUntil, unavailableReason: input.reason },
      });
    }
    const takeoverId = await skipTurn(tx, chore, assignment, {
      by: userId,
      reason: input.reason,
      mode: input.mode,
      now,
    });

    const summary = await tx.chore.findUniqueOrThrow({
      where: { id: choreId },
      select: choreSummarySelect,
    });
    return {
      skipped: await loadAssignment(ctx, assignmentId),
      takeover: takeoverId ? await loadAssignment(ctx, takeoverId) : null,
      chore: toChoreSummary(summary, now),
    };
  });
}

/** Excuses an assignment; the rotation and any existing fine are untouched. */
export function waiveAssignment(
  userId: string,
  groupId: string,
  choreId: string,
  assignmentId: string,
  input: WaiveInput,
) {
  return withChores(userId, groupId, { owner: "waive assignments" }, async (ctx) => {
    const { tx, now } = ctx;
    const { assignment } = await findAssignment(ctx, choreId, assignmentId);
    assertStatus(assignment, OPEN_STATUSES);

    if (input.coveredByAssignmentId) {
      const covering = await tx.choreAssignment.findFirst({
        where: { id: input.coveredByAssignmentId, choreId },
        select: { id: true },
      });
      if (!covering) {
        throw new AppError(400, "coveredByAssignmentId is not an assignment of this chore");
      }
    }

    await tx.choreAssignment.update({
      where: { id: assignmentId },
      data: {
        status: ChoreAssignmentStatus.WAIVED,
        closedById: userId,
        closedAt: now,
        closeReason: input.coveredByAssignmentId
          ? `${input.reason} (covered by assignment ${input.coveredByAssignmentId})`
          : input.reason,
      },
    });
    return { assignment: await loadAssignment(ctx, assignmentId) };
  });
}
