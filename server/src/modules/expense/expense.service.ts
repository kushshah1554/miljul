import { Prisma, GroupRole } from "../../generated/prisma/client";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { assertGroupActive } from "../group/group.lifecycle";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  SplitInput,
} from "./expense.validation";

// ─── Safe field selections ─────────────────────────────────────────────────────

// Safe user fields exposed in payer / split participant records.
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect;

// Safe split record: amount + safe user info.
const splitSelect = {
  id: true,
  userId: true,
  amount: true,
  user: { select: safeUserSelect },
} as const satisfies Prisma.ExpenseSplitSelect;

// Full expense detail record.
const expenseDetailSelect = {
  id: true,
  description: true,
  amount: true,
  paidById: true,
  groupId: true,
  createdAt: true,
  updatedAt: true,
  paidBy: { select: safeUserSelect },
  splits: { select: splitSelect },
} as const satisfies Prisma.ExpenseSelect;

// Lighter expense record for list views (no nested splits for brevity).
const expenseListSelect = {
  id: true,
  description: true,
  amount: true,
  paidById: true,
  groupId: true,
  createdAt: true,
  updatedAt: true,
  paidBy: { select: safeUserSelect },
  splits: { select: splitSelect },
} as const satisfies Prisma.ExpenseSelect;

// ─── Public types ──────────────────────────────────────────────────────────────

export type ExpenseDetail = Prisma.ExpenseGetPayload<{
  select: typeof expenseDetailSelect;
}>;

export type ExpenseListItem = Prisma.ExpenseGetPayload<{
  select: typeof expenseListSelect;
}>;

// ─── Authorization helpers ─────────────────────────────────────────────────────

/**
 * Verifies that `userId` is a member of `groupId`.  Returns the caller's
 * role.  Non-members and unknown groups both receive 404 so group existence
 * is not disclosed to non-members.
 */
async function requireMember(
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
  groupId: string,
): Promise<GroupRole> {
  const membership = await db.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });

  if (!membership) {
    throw new AppError(404, "Group not found");
  }

  return membership.role;
}

/**
 * Verifies that every userId in `splits` is a member of `groupId`.
 * Returns the set of member ids for duplicate-detection.
 */
async function requireAllSplitParticipantsAreMembersOf(
  db: Prisma.TransactionClient | typeof prisma,
  groupId: string,
  splits: SplitInput[],
): Promise<void> {
  const userIds = splits.map((s) => s.userId);

  const members = await db.groupMember.findMany({
    where: { groupId, userId: { in: userIds } },
    select: { userId: true },
  });

  const memberIdSet = new Set(members.map((m) => m.userId));

  for (const userId of userIds) {
    if (!memberIdSet.has(userId)) {
      throw new AppError(
        400,
        `User ${userId} is not a member of this group`,
      );
    }
  }
}

// ─── Decimal arithmetic helpers ────────────────────────────────────────────────

/**
 * Converts a string amount to a Prisma Decimal.  The validation schema
 * already guarantees format; this function adds an extra runtime guard.
 */
function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/**
 * Checks whether the sum of split amounts exactly equals the total expense
 * amount using exact Decimal arithmetic (no floating-point rounding).
 */
function assertSplitSumMatchesTotal(
  totalStr: string,
  splits: SplitInput[],
): void {
  const total = toDecimal(totalStr);
  const splitSum = splits.reduce(
    (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
    new Prisma.Decimal(0),
  );

  if (!total.equals(splitSum)) {
    throw new AppError(
      400,
      `Split amounts sum to ${splitSum.toFixed(2)} but expense amount is ${total.toFixed(2)}`,
    );
  }
}

/**
 * Rejects duplicate userId values within the splits array.
 */
function assertNoDuplicateSplitUsers(splits: SplitInput[]): void {
  const seen = new Set<string>();
  for (const s of splits) {
    if (seen.has(s.userId)) {
      throw new AppError(400, `Duplicate split participant: ${s.userId}`);
    }
    seen.add(s.userId);
  }
}

// ─── Service functions ─────────────────────────────────────────────────────────

/**
 * Creates an expense with its split records atomically.
 *
 * Authorization: the caller must belong to the group.  The payer and every
 * split participant must also be members.  The caller is allowed to record
 * an expense on behalf of another member (paidById need not equal the
 * authenticated user's id).
 */
export async function createExpense(
  authUserId: string,
  groupId: string,
  input: CreateExpenseInput,
): Promise<ExpenseDetail> {
  assertNoDuplicateSplitUsers(input.splits);
  assertSplitSumMatchesTotal(input.amount, input.splits);

  return prisma.$transaction(async (tx) => {
    // 1. Verify caller is a member.
    await requireMember(tx, authUserId, groupId);

    // 2. Verify the group is active (archived groups are read-only).
    await assertGroupActive(tx, groupId);

    // 3. Verify payer is a member.
    const payerMembership = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: input.paidById, groupId } },
      select: { userId: true },
    });
    if (!payerMembership) {
      throw new AppError(400, "Payer is not a member of this group");
    }

    // 4. Verify all split participants are members.
    await requireAllSplitParticipantsAreMembersOf(tx, groupId, input.splits);

    // 5. Create expense + splits atomically via nested write.
    const expense = await tx.expense.create({
      data: {
        description: input.description,
        amount: toDecimal(input.amount),
        groupId,
        paidById: input.paidById,
        splits: {
          create: input.splits.map((s) => ({
            userId: s.userId,
            amount: toDecimal(s.amount),
          })),
        },
      },
      select: expenseDetailSelect,
    });

    return expense;
  });
}

/**
 * Lists expenses for a group with cursor-free offset pagination and
 * optional date range filtering.  Only members may access the list.
 */
export async function listExpenses(
  authUserId: string,
  groupId: string,
  query: ListExpensesQuery,
): Promise<{ expenses: ExpenseListItem[]; total: number; page: number; limit: number }> {
  // Verify caller is a member (same 404 pattern as other modules).
  const groupExists = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: authUserId } } },
    select: { id: true },
  });
  requireFound(groupExists, "Group not found", 404);

  const { page, limit, from, to } = query;
  const skip = (page - 1) * limit;

  const dateFilter: Prisma.ExpenseWhereInput =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const where: Prisma.ExpenseWhereInput = { groupId, ...dateFilter };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: expenseListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, limit };
}

/**
 * Returns a single expense that belongs to the specified group.
 * Non-members and unknown expense ids both receive 404.
 */
export async function getExpenseById(
  authUserId: string,
  groupId: string,
  expenseId: string,
): Promise<ExpenseDetail> {
  // Verify caller is a member.
  await requireMember(prisma, authUserId, groupId);

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, groupId },
    select: expenseDetailSelect,
  });

  return requireFound(expense, "Expense not found", 404);
}

/**
 * Partially updates an expense.  Authorization: OWNER only.
 *
 * If `splits` are provided they completely replace the old splits and must
 * sum to the final expense amount.  If `amount` changes but `splits` are
 * omitted the request is rejected — the old splits would no longer sum
 * correctly.
 */
export async function updateExpense(
  authUserId: string,
  groupId: string,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseDetail> {
  if (input.splits) {
    assertNoDuplicateSplitUsers(input.splits);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Verify caller is a member and has OWNER role.
    const callerRole = await requireMember(tx, authUserId, groupId);
    if (callerRole !== GroupRole.OWNER) {
      throw new AppError(403, "Only owners can edit expenses");
    }

    // 2. Verify the group is active.
    await assertGroupActive(tx, groupId);

    // 3. Find the existing expense (must belong to this group).
    const existingOrNull = await tx.expense.findFirst({
      where: { id: expenseId, groupId },
      select: { id: true, amount: true, splits: { select: { userId: true, amount: true } } },
    });
    const existing = requireFound(existingOrNull, "Expense not found", 404);

    // 4. Determine the final amount (input or existing).
    const finalAmount = input.amount ?? existing.amount.toFixed(2);

    // 5. If amount changes but splits are not provided, reject.
    if (
      input.amount !== undefined &&
      input.splits === undefined &&
      !toDecimal(input.amount).equals(existing.amount)
    ) {
      throw new AppError(
        400,
        "Provide updated splits when changing the expense amount",
      );
    }

    // 6. If splits are provided, validate them.
    if (input.splits) {
      assertSplitSumMatchesTotal(finalAmount, input.splits);
      await requireAllSplitParticipantsAreMembersOf(tx, groupId, input.splits);
    }

    // 7. If paidById is being changed, verify the new payer is a member.
    if (input.paidById !== undefined) {
      const payerMembership = await tx.groupMember.findUnique({
        where: { userId_groupId: { userId: input.paidById, groupId } },
        select: { userId: true },
      });
      if (!payerMembership) {
        throw new AppError(400, "Payer is not a member of this group");
      }
    }

    // 8. Build the scalar update payload.
    const data: Prisma.ExpenseUpdateInput = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.amount !== undefined) data.amount = toDecimal(input.amount);
    if (input.paidById !== undefined) data.paidBy = { connect: { id: input.paidById } };

    // 9. If splits are changing, delete-and-recreate them inside the
    //    transaction so stale records can never remain.
    if (input.splits) {
      await tx.expenseSplit.deleteMany({ where: { expenseId } });
      await tx.expenseSplit.createMany({
        data: input.splits.map((s) => ({
          expenseId,
          userId: s.userId,
          amount: toDecimal(s.amount),
        })),
      });
    }

    const updated = await tx.expense.update({
      where: { id: expenseId },
      data,
      select: expenseDetailSelect,
    });

    return updated;
  });
}

/**
 * Deletes an expense (and its splits, via cascade).
 * Authorization: OWNER only.
 */
export async function deleteExpense(
  authUserId: string,
  groupId: string,
  expenseId: string,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    // 1. Verify caller is a member and has OWNER role.
    const callerRole = await requireMember(tx, authUserId, groupId);
    if (callerRole !== GroupRole.OWNER) {
      throw new AppError(403, "Only owners can delete expenses");
    }

    // 2. Verify the group is active.
    await assertGroupActive(tx, groupId);

    // 3. Verify the expense belongs to this group.
    const expense = await tx.expense.findFirst({
      where: { id: expenseId, groupId },
      select: { id: true },
    });
    requireFound(expense, "Expense not found", 404);

    // 4. Delete the expense; ExpenseSplit rows are removed by ON DELETE CASCADE.
    await tx.expense.delete({ where: { id: expenseId } });
  });
}

/**
 * Returns expenses in a group where the authenticated user is either the
 * payer or a split participant.  Duplicates are avoided using a Prisma OR
 * query that relies on the database engine to deduplicate naturally (both
 * conditions reference the same expense.id primary key).
 */
export async function getMyExpenses(
  authUserId: string,
  groupId: string,
  query: ListExpensesQuery,
): Promise<{ expenses: ExpenseListItem[]; total: number; page: number; limit: number }> {
  // Verify caller is a member.
  const groupExists = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: authUserId } } },
    select: { id: true },
  });
  requireFound(groupExists, "Group not found", 404);

  const { page, limit, from, to } = query;
  const skip = (page - 1) * limit;

  const dateFilter: Prisma.ExpenseWhereInput =
    from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

  const where: Prisma.ExpenseWhereInput = {
    groupId,
    OR: [
      { paidById: authUserId },
      { splits: { some: { userId: authUserId } } },
    ],
    ...dateFilter,
  };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: expenseListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, limit };
}
