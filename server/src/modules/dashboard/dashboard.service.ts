import { ChoreAssignmentStatus, ChoreFineStatus, Prisma } from "../../generated/prisma/client";
import { requireFound } from "../../utils/helpers";
import { prisma } from "../../utils/prisma";
import { localDateString, localMidnight } from "../../utils/timezone";
import type { DashboardQuery } from "./dashboard.validation";

/** Sum of expenses the user paid (full amount, not their share). */
async function sumSpent(userId: string, createdAt: Prisma.DateTimeFilter) {
  const { _sum } = await prisma.expense.aggregate({
    where: { paidById: userId, createdAt },
    _sum: { amount: true },
  });
  return (_sum.amount ?? new Prisma.Decimal(0)).toFixed(2);
}

/** Sum of ACTIVE fines the user owes. */
async function sumFines(userId: string, createdAt: Prisma.DateTimeFilter) {
  const { _sum } = await prisma.choreFineShare.aggregate({
    where: { fine: { payerId: userId, status: ChoreFineStatus.ACTIVE, createdAt } },
    _sum: { amount: true },
  });
  return (_sum.amount ?? new Prisma.Decimal(0)).toFixed(2);
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

  const today = localDateString(now, timezone);
  const currentYear = Number(today.slice(0, 4));
  const year = requestedYear ?? currentYear;
  const firstYear = Number(localDateString(user.createdAt, timezone).slice(0, 4));
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) => currentYear - i);

  const inYear = {
    gte: localMidnight(`${year}-01-01`, timezone),
    lt: localMidnight(`${year + 1}-01-01`, timezone),
  };
  const inMonth = { gte: localMidnight(`${today.slice(0, 7)}-01`, timezone) };
  const inToday = { gte: localMidnight(today, timezone) };

  // Today and this month only exist in the current year.
  const totals = async (sum: typeof sumSpent) => {
    const [todayTotal, month, yearTotal] = await Promise.all([
      year === currentYear ? sum(userId, inToday) : null,
      year === currentYear ? sum(userId, inMonth) : null,
      sum(userId, inYear),
    ]);
    return { today: todayTotal, month, year: yearTotal };
  };

  // A chore belongs to the year it was first submitted in.
  const { APPROVED, REJECTED, SUBMITTED } = ChoreAssignmentStatus;
  const deadline = prisma.choreAssignment.fields.deadlineAt;
  const [groupsJoined, spent, fines, late, rejected, approved] = await Promise.all([
    prisma.groupMember.count({ where: { userId } }),
    totals(sumSpent),
    totals(sumFines),
    prisma.choreAssignment.count({
      where: {
        userId,
        status: { in: [SUBMITTED, APPROVED, REJECTED] },
        firstSubmittedAt: { ...inYear, gt: deadline },
      },
    }),
    prisma.choreAssignment.count({
      where: { userId, status: REJECTED, firstSubmittedAt: inYear },
    }),
    // On time and without an active fine (a voided fine does not count)
    prisma.choreAssignment.count({
      where: {
        userId,
        status: APPROVED,
        firstSubmittedAt: { ...inYear, lte: deadline },
        NOT: { fine: { is: { status: ChoreFineStatus.ACTIVE } } },
      },
    }),
  ]);

  return { year, years, groupsJoined, spent, fines, chores: { late, rejected, approved } };
}
