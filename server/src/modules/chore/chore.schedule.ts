import { ChoreAssignmentStatus, ChoreSkipMode } from "../../generated/prisma/client";
import { addLocalDays } from "../../utils/timezone";

// Pure rotation rules, kept free of Prisma calls so they can be unit-tested.

type TurnRow = {
  userId: string;
  status: ChoreAssignmentStatus;
  skipMode: ChoreSkipMode | null;
};

/**
 * Members locked in a cycle: anyone who held a turn in it, whatever the
 * outcome, except a DEFER skip (that member still owes a turn).
 */
export function lockedUsers(turns: TurnRow[]): Set<string> {
  return new Set(
    turns
      .filter(
        (t) =>
          !(
            t.status === ChoreAssignmentStatus.SKIPPED &&
            t.skipMode === ChoreSkipMode.DEFER
          ),
      )
      .map((t) => t.userId),
  );
}

/** Splits a cycle order into its locked prefix and the pending rest. */
export function splitOrder(order: string[], locked: Set<string>) {
  return {
    locked: order.filter((u) => locked.has(u)),
    pending: order.filter((u) => !locked.has(u)),
  };
}

/** Moves `userId` to the first pending slot so locked members stay at the front. */
export function promote(order: string[], locked: Set<string>, userId: string): string[] {
  const split = splitOrder(order, locked);
  return [...split.locked, userId, ...split.pending.filter((u) => u !== userId)];
}

export type Availability = Map<string, Date | null>; // active participant → unavailableUntil

export function isAvailable(availability: Availability, userId: string, at: Date): boolean {
  if (!availability.has(userId)) return false; // removed from the chore
  const until = availability.get(userId);
  return !until || until.getTime() <= at.getTime();
}

export type UpcomingTurn = {
  userId: string;
  startsAt: Date;
  endsAt: Date;
  cycleNumber: number;
};

/**
 * Projects the next `count` turns after the current one ends, skipping
 * members unavailable at each slot start. Stops early when a fresh cycle
 * would have nobody available (the chore would stall).
 */
export function projectUpcoming(input: {
  from: Date;
  intervalDays: number;
  timezone: string;
  cycleNumber: number;
  pending: string[];
  originalQueue: string[];
  availability: Availability;
  count: number;
}): UpcomingTurn[] {
  const result: UpcomingTurn[] = [];
  let pending = [...input.pending];
  let cycleNumber = input.cycleNumber;
  let at = input.from;

  while (result.length < input.count) {
    const next = pending.find((u) => isAvailable(input.availability, u, at));
    if (next) {
      const endsAt = addLocalDays(at, input.intervalDays, input.timezone);
      result.push({ userId: next, startsAt: at, endsAt, cycleNumber });
      pending = pending.filter((u) => u !== next);
      at = endsAt;
      continue;
    }
    // Nobody pending is available: the cycle ends and a new one starts.
    cycleNumber += 1;
    pending = [...input.originalQueue];
    if (!pending.some((u) => isAvailable(input.availability, u, at))) break;
  }

  return result;
}
