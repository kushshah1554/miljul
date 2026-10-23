import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../utils/prisma";
import { requireFound } from "../../utils/helpers";

// ─── Public types ──────────────────────────────────────────────────────────────

export type MemberBalance = {
  userId: string;
  name: string;
  email: string;
  /** Decimal string, e.g. "500.00" */
  totalPaid: string;
  /** Decimal string, e.g. "100.00" */
  totalShares: string;
  /** Decimal string; positive = owed money, negative = owes money */
  netBalance: string;
};

export type SettlementSuggestion = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);

// ─── Core calculation ──────────────────────────────────────────────────────────

/**
 * Computes net balances for every current member of `groupId`.
 *
 * Uses exactly three database queries (members + two aggregations), so the
 * cost is constant regardless of how many members the group has.
 *
 * Formula:  netBalance = totalPaid − totalShares
 *   - totalPaid:   sum of Expense.amount  where Expense.paidById = userId
 *                  AND Expense.groupId = groupId
 *   - totalShares: sum of ExpenseSplit.amount where ExpenseSplit.userId = userId
 *                  AND the parent Expense.groupId = groupId
 *
 * Members with no paid expenses and no assigned shares receive "0.00" for
 * all three monetary fields.
 *
 * This function is intentionally NOT exported — callers must go through the
 * public service functions which perform the membership/authorization checks
 * first.
 */
async function computeGroupBalances(groupId: string): Promise<MemberBalance[]> {
  // 1. All current members, ordered by name for a stable, predictable response.
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  if (members.length === 0) return [];

  // 2. Total paid per user (Expense.amount grouped by paidById) &
  //    total shares per user (ExpenseSplit.amount grouped by userId).
  //    Both queries are scoped to this group only — no cross-group data leaks.
  const [paidRows, shareRows] = await Promise.all([
    prisma.expense.groupBy({
      by: ["paidById"],
      where: { groupId },
      _sum: { amount: true },
    }),
    prisma.expenseSplit.groupBy({
      by: ["userId"],
      where: { expense: { groupId } },
      _sum: { amount: true },
    }),
  ]);

  // Build O(1) lookup maps.
  const paidMap = new Map<string, Prisma.Decimal>();
  for (const row of paidRows) {
    if (row._sum.amount !== null) {
      paidMap.set(row.paidById, row._sum.amount);
    }
  }

  const shareMap = new Map<string, Prisma.Decimal>();
  for (const row of shareRows) {
    if (row._sum.amount !== null) {
      shareMap.set(row.userId, row._sum.amount);
    }
  }

  // 3. Combine — exact Decimal arithmetic, no floating-point.
  return members.map(({ userId, user }) => {
    const totalPaid = paidMap.get(userId) ?? ZERO;
    const totalShares = shareMap.get(userId) ?? ZERO;
    const netBalance = totalPaid.sub(totalShares);

    return {
      userId,
      name: user.name,
      email: user.email,
      totalPaid: totalPaid.toFixed(2),
      totalShares: totalShares.toFixed(2),
      netBalance: netBalance.toFixed(2),
    };
  });
}

// ─── Settlement suggestion ─────────────────────────────────────────────────────

/**
 * Derives a simplified settlement plan from a set of member balances using a
 * greedy two-pointer algorithm.
 *
 * This is a *derived recommendation*, not a record of actual payments.
 * The function is pure (no DB access) and exported for independent testing.
 *
 * The sum of all suggested `amount` values will equal the sum of all positive
 * net balances (and the absolute value of all negative net balances), subject
 * to the two-decimal precision of the stored amounts.
 */
export function computeSettlements(
  balances: MemberBalance[],
): SettlementSuggestion[] {
  // Members with a balance of exactly "0.00" participate in neither side.
  const creditors: Array<{
    userId: string;
    name: string;
    remaining: Prisma.Decimal;
  }> = [];
  const debtors: Array<{
    userId: string;
    name: string;
    remaining: Prisma.Decimal;
  }> = [];

  for (const b of balances) {
    const net = new Prisma.Decimal(b.netBalance);
    if (net.greaterThan(ZERO)) {
      creditors.push({ userId: b.userId, name: b.name, remaining: net });
    } else if (net.lessThan(ZERO)) {
      debtors.push({ userId: b.userId, name: b.name, remaining: net.abs() });
    }
  }

  const suggestions: SettlementSuggestion[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    // Transfer is bounded by the smaller of the two outstanding amounts.
    const transfer = creditor.remaining.lessThan(debtor.remaining)
      ? creditor.remaining
      : debtor.remaining;

    suggestions.push({
      fromUserId: debtor.userId,
      fromName: debtor.name,
      toUserId: creditor.userId,
      toName: creditor.name,
      amount: transfer.toFixed(2),
    });

    creditor.remaining = creditor.remaining.sub(transfer);
    debtor.remaining = debtor.remaining.sub(transfer);

    // Advance the pointer whose side is now fully settled.
    if (creditor.remaining.equals(ZERO)) ci += 1;
    if (debtor.remaining.equals(ZERO)) di += 1;
  }

  return suggestions;
}

// ─── Public service functions ──────────────────────────────────────────────────

/**
 * Returns the net balance for every current member in the group plus a
 * derived settlement suggestion list.
 *
 * Authorization: caller must be a member of the group.  Non-members and
 * unknown group ids both receive 404 (group existence is never disclosed).
 */
export async function getGroupBalances(
  authUserId: string,
  groupId: string,
): Promise<{
  groupId: string;
  balances: MemberBalance[];
  suggestedSettlements: SettlementSuggestion[];
}> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: authUserId } } },
    select: { id: true },
  });
  requireFound(group, "Group not found", 404);

  const balances = await computeGroupBalances(groupId);
  const suggestedSettlements = computeSettlements(balances);

  return { groupId, balances, suggestedSettlements };
}

/**
 * Returns only the authenticated user's balance in the group.
 *
 * Reuses `computeGroupBalances` so the calculation is guaranteed to be
 * identical to the all-balances endpoint — no duplicate logic.
 *
 * The caller's userId always comes from the verified auth context, never
 * from the request body or query string.
 */
export async function getMyGroupBalance(
  authUserId: string,
  groupId: string,
): Promise<{
  groupId: string;
  userId: string;
  totalPaid: string;
  totalShares: string;
  netBalance: string;
}> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: authUserId } } },
    select: { id: true },
  });
  requireFound(group, "Group not found", 404);

  // Reuse the shared calculation — both endpoints always agree.
  const allBalances = await computeGroupBalances(groupId);
  const mine = allBalances.find((b) => b.userId === authUserId);

  // The findFirst above confirmed membership, so `mine` will always be found.
  // The fallback guard satisfies TypeScript and handles any unexpected edge case.
  const result = mine ?? {
    userId: authUserId,
    totalPaid: "0.00",
    totalShares: "0.00",
    netBalance: "0.00",
  };

  return {
    groupId,
    userId: result.userId,
    totalPaid: result.totalPaid,
    totalShares: result.totalShares,
    netBalance: result.netBalance,
  };
}
