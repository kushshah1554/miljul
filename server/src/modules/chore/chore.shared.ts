import {
  Prisma,
  ChoreAssignmentStatus,
  ChoreStatus,
} from "../../generated/prisma/client";
import { requireFound } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { lockedUsers, splitOrder, projectUpcoming } from "./chore.schedule";
import type { Availability } from "./chore.schedule";

type Tx = Prisma.TransactionClient;

// ─── Selections ───────────────────────────────────────────────────────────────

export const choreUserSelect = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect;

export const assignmentSelect = {
  id: true,
  choreId: true,
  cycleId: true,
  userId: true,
  startsAt: true,
  endsAt: true,
  deadlineAt: true,
  status: true,
  firstSubmittedAt: true,
  submittedAt: true,
  submissionNote: true,
  skipRequestedAt: true,
  skipRequestReason: true,
  skipMode: true,
  closedAt: true,
  closeReason: true,
  replacedById: true,
  user: { select: choreUserSelect },
  closedBy: { select: choreUserSelect },
  // Needed to derive isOverdue (a frozen clock stops deadlines) and choreName.
  chore: { select: { name: true, frozenAt: true } },
} as const satisfies Prisma.ChoreAssignmentSelect;

export const participantSelect = {
  userId: true,
  user: { select: choreUserSelect },
  position: true,
  joinedAt: true,
  removedAt: true,
  unavailableUntil: true,
  unavailableReason: true,
} as const satisfies Prisma.ChoreParticipantSelect;

export const checklistSelect = {
  id: true,
  label: true,
  position: true,
} as const satisfies Prisma.ChoreChecklistItemSelect;

export const reviewSelect = {
  id: true,
  reviewer: { select: choreUserSelect },
  decision: true,
  results: true,
  feedback: true,
  createdAt: true,
} as const satisfies Prisma.ChoreReviewSelect;

export const fineSelect = {
  id: true,
  assignmentId: true,
  reasons: true,
  status: true,
  voidReason: true,
  createdAt: true,
  payer: { select: choreUserSelect },
  voidedBy: { select: choreUserSelect },
  shares: { select: { amount: true, recipient: { select: choreUserSelect } } },
  assignment: { select: { choreId: true, chore: { select: { name: true } } } },
} as const satisfies Prisma.ChoreFineSelect;

export const pauseSelect = {
  id: true,
  choreId: true,
  pausedBy: { select: choreUserSelect },
  pausedAt: true,
  reason: true,
  resumedBy: { select: choreUserSelect },
  resumedAt: true,
  resumeReason: true,
} as const satisfies Prisma.ChorePauseSelect;

export const choreSummarySelect = {
  id: true,
  name: true,
  description: true,
  intervalDays: true,
  deadlineMinutes: true,
  finePerMember: true,
  status: true,
  frozenAt: true,
  currentAssignment: { select: assignmentSelect },
} as const satisfies Prisma.ChoreSelect;

// Fields the rotation engine and services need to make decisions.
export const choreStateSelect = {
  id: true,
  name: true,
  status: true,
  frozenAt: true,
  currentAssignmentId: true,
  intervalDays: true,
  deadlineMinutes: true,
  finePerMember: true,
} as const satisfies Prisma.ChoreSelect;

export type ChoreState = Prisma.ChoreGetPayload<{ select: typeof choreStateSelect }>;
type AssignmentRow = Prisma.ChoreAssignmentGetPayload<{ select: typeof assignmentSelect }>;
type FineRow = Prisma.ChoreFineGetPayload<{ select: typeof fineSelect }>;
type SummaryRow = Prisma.ChoreGetPayload<{ select: typeof choreSummarySelect }>;

// ─── Serializers ──────────────────────────────────────────────────────────────

export function toAssignment(row: AssignmentRow, now: Date) {
  const { chore, ...rest } = row;
  const clock = chore.frozenAt ?? now;
  const isOverdue =
    row.status === ChoreAssignmentStatus.PENDING && clock > row.deadlineAt;
  const wasLate = row.firstSubmittedAt
    ? row.firstSubmittedAt > row.deadlineAt
    : isOverdue;
  return { ...rest, isOverdue, wasLate };
}

export function toFine(row: FineRow) {
  const { assignment, shares, ...rest } = row;
  const total = shares.reduce((sum, s) => sum.add(s.amount), new Prisma.Decimal(0));
  return {
    ...rest,
    choreId: assignment.choreId,
    choreName: assignment.chore.name,
    totalAmount: total.toFixed(2),
    shares: shares.map((s) => ({ recipient: s.recipient, amount: s.amount.toFixed(2) })),
  };
}

export function toChoreSummary(row: SummaryRow, now: Date) {
  const { frozenAt, currentAssignment, finePerMember, ...rest } = row;
  const running = !frozenAt && row.status !== ChoreStatus.ARCHIVED;
  return {
    ...rest,
    finePerMember: finePerMember.toFixed(2),
    isFrozen: frozenAt !== null,
    currentAssignment: currentAssignment ? toAssignment(currentAssignment, now) : null,
    nextRotationAt: running && currentAssignment ? currentAssignment.endsAt : null,
  };
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function findChore(tx: Tx, groupId: string, choreId: string) {
  const chore = await tx.chore.findFirst({
    where: { id: choreId, groupId },
    select: choreStateSelect,
  });
  return requireFound(chore, "Chore not found");
}

export function assertChoreNotArchived(chore: { status: ChoreStatus }) {
  if (chore.status === ChoreStatus.ARCHIVED) {
    throw new AppError(409, "Chore is archived");
  }
}

/** The open cycle with its locked members (null only for archived chores). */
export async function openCycle(tx: Tx, choreId: string) {
  const cycle = await tx.choreCycle.findFirst({
    where: { choreId, endedAt: null },
    orderBy: { number: "desc" },
    select: {
      id: true,
      number: true,
      order: true,
      startedAt: true,
      endedAt: true,
      assignments: { select: { userId: true, status: true, skipMode: true } },
    },
  });
  if (!cycle) return null;
  const { assignments, ...rest } = cycle;
  return { ...rest, turns: assignments.length, locked: lockedUsers(assignments) };
}

export type OpenCycle = NonNullable<Awaited<ReturnType<typeof openCycle>>>;

export function toCycle(cycle: OpenCycle) {
  const { turns: _turns, locked, ...rest } = cycle;
  return { ...rest, lockedCount: splitOrder(cycle.order, locked).locked.length };
}

/** Active participants in original-queue order, with their availability. */
export async function loadParticipants(tx: Tx, choreId: string) {
  const rows = await tx.choreParticipant.findMany({
    where: { choreId, removedAt: null },
    orderBy: { position: "asc" },
    select: { userId: true, unavailableUntil: true },
  });
  return {
    originalQueue: rows.map((r) => r.userId),
    availability: new Map(rows.map((r) => [r.userId, r.unavailableUntil])) as Availability,
  };
}

/** Rewrites original-queue positions to match `queue`. */
export async function writeQueue(tx: Tx, choreId: string, queue: string[]) {
  for (const [position, userId] of queue.entries()) {
    await tx.choreParticipant.update({
      where: { choreId_userId: { choreId, userId } },
      data: { position },
    });
  }
}

// ─── Composite reads ──────────────────────────────────────────────────────────

export async function getUpcoming(
  tx: Tx,
  choreId: string,
  timezone: string,
  count: number,
) {
  const chore = await tx.chore.findUniqueOrThrow({
    where: { id: choreId },
    select: {
      status: true,
      intervalDays: true,
      currentAssignment: { select: { endsAt: true } },
    },
  });
  const cycle = await openCycle(tx, choreId);
  if (!cycle || !chore.currentAssignment || chore.status === ChoreStatus.ARCHIVED) {
    return [];
  }
  const { originalQueue, availability } = await loadParticipants(tx, choreId);
  return projectUpcoming({
    from: chore.currentAssignment.endsAt,
    intervalDays: chore.intervalDays,
    timezone,
    cycleNumber: cycle.number,
    pending: splitOrder(cycle.order, cycle.locked).pending,
    originalQueue,
    availability,
    count,
  });
}

export async function getChoreDetail(
  tx: Tx,
  choreId: string,
  timezone: string,
  now: Date,
  upcomingCount = 10,
) {
  const row = await tx.chore.findUniqueOrThrow({
    where: { id: choreId },
    select: {
      ...choreSummarySelect,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: choreUserSelect },
      participants: {
        where: { removedAt: null },
        orderBy: { position: "asc" },
        select: participantSelect,
      },
      checklist: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: checklistSelect,
      },
    },
  });
  // Sequential: queries on one interactive-transaction connection cannot overlap.
  const cycle = await openCycle(tx, choreId);
  const openAssignments = await tx.choreAssignment.findMany({
    where: {
      choreId,
      status: { in: [ChoreAssignmentStatus.PENDING, ChoreAssignmentStatus.SUBMITTED] },
    },
    orderBy: { startsAt: "asc" },
    select: assignmentSelect,
  });
  const upcoming = await getUpcoming(tx, choreId, timezone, upcomingCount);

  const { createdAt, updatedAt, createdBy, participants, checklist, ...summary } = row;
  return {
    ...toChoreSummary(summary, now),
    createdBy,
    createdAt,
    updatedAt,
    participants,
    originalQueue: participants.map((p) => p.userId),
    currentCycle: cycle ? toCycle(cycle) : null,
    upcoming,
    checklist,
    openAssignments: openAssignments.map((a) => toAssignment(a, now)),
  };
}
