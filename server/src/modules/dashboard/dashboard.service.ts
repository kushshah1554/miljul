import { ChoreAssignmentStatus, ChoreFineStatus, Prisma } from "../../generated/prisma/client";
import { requireFound } from "../../utils/helpers";
import { prisma } from "../../utils/prisma";
import { localDateString, localMidnight } from "../../utils/timezone";
import type { DashboardQuery, LeaderboardQuery, OverviewQuery } from "./dashboard.validation";

/** Whose records to count: one user's, one group's, or one user's in one group. */
type Scope = { userId: string; groupId?: string } | { userId?: undefined; groupId: string };
type Period = { gte: Date; lt?: Date };

const toAmount = (sum: Prisma.Decimal | null | undefined) => (sum ?? new Prisma.Decimal(0)).toFixed(2);

/** Expenses paid (full amount, not the payer's share). */
const expenseWhere = ({ userId, groupId }: Scope, createdAt: Period) =>
  ({ paidById: userId, groupId, createdAt }) satisfies Prisma.ExpenseWhereInput;

/** ACTIVE fines, counted for the member who owes them. */
const fineShareWhere = ({ userId, groupId }: Scope, createdAt: Period) =>
  ({
    fine: {
      payerId: userId,
      status: ChoreFineStatus.ACTIVE,
      createdAt,
      ...(groupId && { assignment: { chore: { groupId } } }),
    },
  }) satisfies Prisma.ChoreFineShareWhereInput;

/** A chore belongs to the period it was first submitted in. */
function choreWheres({ userId, groupId }: Scope, period: Period) {
  const { APPROVED, REJECTED, SUBMITTED } = ChoreAssignmentStatus;
  const deadline = prisma.choreAssignment.fields.deadlineAt;
  const base = { userId, ...(groupId && { chore: { groupId } }) };
  return {
    late: {
      ...base,
      status: { in: [SUBMITTED, APPROVED, REJECTED] },
      firstSubmittedAt: { ...period, gt: deadline },
    },
    rejected: { ...base, status: REJECTED, firstSubmittedAt: period },
    // On time and without an active fine (a voided fine does not count)
    approved: {
      ...base,
      status: APPROVED,
      firstSubmittedAt: { ...period, lte: deadline },
      NOT: { fine: { is: { status: ChoreFineStatus.ACTIVE } } },
    },
  } satisfies Record<string, Prisma.ChoreAssignmentWhereInput>;
}

async function sumSpent(scope: Scope, period: Period) {
  const { _sum } = await prisma.expense.aggregate({
    where: expenseWhere(scope, period),
    _sum: { amount: true },
  });
  return toAmount(_sum.amount);
}

async function sumFines(scope: Scope, period: Period) {
  const { _sum } = await prisma.choreFineShare.aggregate({
    where: fineShareWhere(scope, period),
    _sum: { amount: true },
  });
  return toAmount(_sum.amount);
}

function yearPeriod(year: number, timezone: string) {
  return {
    gte: localMidnight(`${year}-01-01`, timezone),
    lt: localMidnight(`${year + 1}-01-01`, timezone),
  };
}

/** Current year back to the year of `since`. */
function yearsSince(since: Date, currentYear: number, timezone: string) {
  const firstYear = Number(localDateString(since, timezone).slice(0, 4));
  return Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);
}

const localYear = (now: Date, timezone: string) => Number(localDateString(now, timezone).slice(0, 4));

/** Money, fine and chore totals of one year. */
async function getTotals(scope: Scope, year: number, timezone: string, now: Date) {
  const today = localDateString(now, timezone);
  const isCurrent = year === localYear(now, timezone);
  const inYear = yearPeriod(year, timezone);
  const inMonth = { gte: localMidnight(`${today.slice(0, 7)}-01`, timezone) };
  const inToday = { gte: localMidnight(today, timezone) };

  // Today and this month only exist in the current year.
  const totals = async (sum: typeof sumSpent) => {
    const [todayTotal, month, yearTotal] = await Promise.all([
      isCurrent ? sum(scope, inToday) : null,
      isCurrent ? sum(scope, inMonth) : null,
      sum(scope, inYear),
    ]);
    return { today: todayTotal, month, year: yearTotal };
  };

  const chores = choreWheres(scope, inYear);
  const [spent, fines, late, rejected, approved] = await Promise.all([
    totals(sumSpent),
    totals(sumFines),
    prisma.choreAssignment.count({ where: chores.late }),
    prisma.choreAssignment.count({ where: chores.rejected }),
    prisma.choreAssignment.count({ where: chores.approved }),
  ]);
  return { spent, fines, chores: { late, rejected, approved } };
}

/**
 * The user's own totals across every group, including archived groups and
 * groups they left. Days and years follow the caller's timezone, because
 * groups can each have a different one.
 */
export async function getDashboard(
  userId: string,
  { year: requestedYear, timezone }: DashboardQuery,
  now = new Date(),
) {
  const user = requireFound(
    await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    "User not found",
  );
  const currentYear = localYear(now, timezone);
  const year = requestedYear ?? currentYear;

  const [groupsJoined, totals] = await Promise.all([
    prisma.groupMember.count({ where: { userId } }),
    getTotals({ userId }, year, timezone, now),
  ]);
  return { year, years: yearsSince(user.createdAt, currentYear, timezone), groupsJoined, ...totals };
}

/** Members only; archived groups stay readable. */
async function findMemberGroup(userId: string, groupId: string) {
  const membership = requireFound(
    await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: { group: { select: { createdAt: true, timezone: true } } },
    }),
    "Group not found",
  );
  return membership.group;
}

/** One group's totals, the caller's own and everyone's, in the group's timezone. */
export async function getGroupOverview(
  userId: string,
  groupId: string,
  { year: requestedYear }: OverviewQuery,
  now = new Date(),
) {
  const { createdAt, timezone } = await findMemberGroup(userId, groupId);
  const currentYear = localYear(now, timezone);
  const year = requestedYear ?? currentYear;

  const [mine, group] = await Promise.all([
    getTotals({ userId, groupId }, year, timezone, now),
    getTotals({ groupId }, year, timezone, now),
  ]);
  return { year, years: yearsSince(createdAt, currentYear, timezone), mine, group };
}

/**
 * Per-member totals of a year or one of its months. Lists everyone with a
 * record in that period, including members who left, so the rows add up to
 * the group totals.
 */
export async function getGroupLeaderboard(
  userId: string,
  groupId: string,
  { year: requestedYear, month }: LeaderboardQuery,
  now = new Date(),
) {
  const { timezone } = await findMemberGroup(userId, groupId);
  const currentYear = localYear(now, timezone);
  const year = requestedYear ?? currentYear;
  const monthCount = year === currentYear ? Number(localDateString(now, timezone).slice(5, 7)) : 12;
  const period = month
    ? {
        gte: localMidnight(`${year}-${month}-1`, timezone),
        lt: localMidnight(`${year}-${month + 1}-1`, timezone), // month 13 rolls over to January
      }
    : yearPeriod(year, timezone);

  const scope = { groupId };
  const chores = choreWheres(scope, period);
  const countByUser = (where: Prisma.ChoreAssignmentWhereInput) =>
    prisma.choreAssignment.groupBy({ by: ["userId"], where, _count: { _all: true } });
  const [expenses, shares, late, rejected, approved] = await Promise.all([
    prisma.expense.groupBy({
      by: ["paidById"],
      where: expenseWhere(scope, period),
      _sum: { amount: true },
    }),
    prisma.choreFineShare.findMany({
      where: fineShareWhere(scope, period),
      select: { amount: true, fine: { select: { payerId: true } } },
    }),
    countByUser(chores.late),
    countByUser(chores.rejected),
    countByUser(chores.approved),
  ]);

  const spent = new Map(expenses.map((e) => [e.paidById, e._sum.amount]));
  const fines = new Map<string, Prisma.Decimal>();
  for (const { amount, fine } of shares) {
    fines.set(fine.payerId, amount.add(fines.get(fine.payerId) ?? 0));
  }
  const toCounts = (rows: typeof late) => new Map(rows.map((r) => [r.userId, r._count._all]));
  const counts = { late: toCounts(late), rejected: toCounts(rejected), approved: toCounts(approved) };

  const ids = [spent, fines, ...Object.values(counts)].flatMap((m) => [...m.keys()]);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, profileUrl: true },
  });

  return {
    year,
    month: month ?? null,
    months: Array.from({ length: monthCount }, (_, i) => i + 1),
    members: users.map((user) => ({
      user,
      spent: toAmount(spent.get(user.id)),
      fines: toAmount(fines.get(user.id)),
      late: counts.late.get(user.id) ?? 0,
      rejected: counts.rejected.get(user.id) ?? 0,
      approved: counts.approved.get(user.id) ?? 0,
    })),
  };
}
