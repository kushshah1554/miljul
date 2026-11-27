import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import { getDashboard, getGroupLeaderboard, getGroupOverview } from "./dashboard.service";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    groupMember: { count: vi.fn(), findUnique: vi.fn() },
    expense: { aggregate: vi.fn(), groupBy: vi.fn() },
    choreFineShare: { aggregate: vi.fn(), findMany: vi.fn() },
    choreAssignment: { count: vi.fn(), groupBy: vi.fn(), fields: { deadlineAt: "deadlineAt" } },
  },
}));
vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

const timezone = "Asia/Kathmandu"; // UTC+5:45
// 2026-01-01 00:15 in Kathmandu, still 2025 in UTC
const NOW = new Date("2025-12-31T18:30:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ createdAt: new Date("2024-05-01T00:00:00Z") });
  prismaMock.groupMember.count.mockResolvedValue(2);
  prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal("12.5") } });
  prismaMock.choreFineShare.aggregate.mockResolvedValue({ _sum: { amount: null } });
  prismaMock.choreAssignment.count
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(3);
});

describe("getDashboard", () => {
  it("defaults to the current year in the caller's timezone", async () => {
    const result = await getDashboard("u1", { timezone }, NOW);

    expect(result).toEqual({
      year: 2026,
      years: [2026, 2025, 2024],
      groupsJoined: 2,
      spent: { today: "12.50", month: "12.50", year: "12.50" },
      fines: { today: "0.00", month: "0.00", year: "0.00" },
      chores: { late: 1, rejected: 2, approved: 3 },
    });
    const start = new Date("2025-12-31T18:15:00Z");
    const wheres = prismaMock.expense.aggregate.mock.calls.map(([a]) => a.where);
    expect(wheres.every((w) => w.paidById === "u1")).toBe(true);
    expect(wheres.map((w) => w.createdAt.gte)).toEqual([start, start, start]);
  });

  it("returns only the year total for a past year", async () => {
    const result = await getDashboard("u1", { year: 2025, timezone }, NOW);

    expect(result.spent).toEqual({ today: null, month: null, year: "12.50" });
    expect(prismaMock.expense.aggregate.mock.calls.map(([a]) => a.where.createdAt)).toEqual([
      { gte: new Date("2024-12-31T18:15:00Z"), lt: new Date("2025-12-31T18:15:00Z") },
    ]);
  });

  it("counts only active fines the user owes", async () => {
    await getDashboard("u1", { timezone }, NOW);

    for (const [{ where }] of prismaMock.choreFineShare.aggregate.mock.calls) {
      expect(where.fine).toMatchObject({ payerId: "u1", status: "ACTIVE" });
    }
  });
});

describe("group overview and leaderboard", () => {
  const D = (v: string) => new Prisma.Decimal(v);

  beforeEach(() => {
    prismaMock.groupMember.findUnique.mockResolvedValue({
      group: { createdAt: new Date("2025-03-01T00:00:00Z"), timezone },
    });
  });

  it("rejects non-members before reading anything", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);

    await expect(getGroupOverview("u1", "g1", {}, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(getGroupLeaderboard("u1", "g1", {}, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.expense.aggregate).not.toHaveBeenCalled();
    expect(prismaMock.expense.groupBy).not.toHaveBeenCalled();
  });

  it("limits every overview query to the group, for me and for everyone", async () => {
    const result = await getGroupOverview("u1", "g1", {}, NOW);

    expect(result).toMatchObject({ year: 2026, years: [2026, 2025] });
    const expenses = prismaMock.expense.aggregate.mock.calls.map(([a]) => a.where);
    const fines = prismaMock.choreFineShare.aggregate.mock.calls.map(([a]) => a.where.fine);
    const chores = prismaMock.choreAssignment.count.mock.calls.map(([a]) => a.where);
    expect(expenses.every((w) => w.groupId === "g1")).toBe(true);
    expect(fines.every((w) => w.assignment.chore.groupId === "g1")).toBe(true);
    expect(chores.every((w) => w.chore.groupId === "g1")).toBe(true);
    for (const users of [expenses.map((w) => w.paidById), fines.map((w) => w.payerId), chores.map((w) => w.userId)]) {
      expect(users.filter((u) => u === "u1")).toHaveLength(3);
      expect(users.filter((u) => u === undefined)).toHaveLength(3);
    }
  });

  it("merges the totals per member for one month", async () => {
    prismaMock.expense.groupBy.mockResolvedValue([{ paidById: "a", _sum: { amount: D("10") } }]);
    prismaMock.choreFineShare.findMany.mockResolvedValue([
      { amount: D("20"), fine: { payerId: "b" } },
      { amount: D("20.5"), fine: { payerId: "b" } },
    ]);
    prismaMock.choreAssignment.groupBy
      .mockResolvedValueOnce([{ userId: "b", _count: { _all: 2 } }]) // late
      .mockResolvedValueOnce([]) // rejected
      .mockResolvedValueOnce([{ userId: "a", _count: { _all: 4 } }]); // approved
    const a = { id: "a", name: "A", profileUrl: null };
    const b = { id: "b", name: "B", profileUrl: null };
    prismaMock.user.findMany.mockResolvedValue([a, b]);

    const result = await getGroupLeaderboard("u1", "g1", { year: 2025, month: 12 }, NOW);

    expect(result.members).toEqual([
      { user: a, spent: "10.00", fines: "0.00", late: 0, rejected: 0, approved: 4 },
      { user: b, spent: "0.00", fines: "40.50", late: 2, rejected: 0, approved: 0 },
    ]);
    expect(result.months).toHaveLength(12);
    expect(prismaMock.user.findMany.mock.calls[0]![0].where.id.in).toEqual(["a", "b"]);
    expect(prismaMock.expense.groupBy.mock.calls[0]![0].where.createdAt).toEqual({
      gte: new Date("2025-11-30T18:15:00Z"),
      lt: new Date("2025-12-31T18:15:00Z"),
    });
  });

  it("offers only the months so far in the current year", async () => {
    prismaMock.expense.groupBy.mockResolvedValue([]);
    prismaMock.choreFineShare.findMany.mockResolvedValue([]);
    prismaMock.choreAssignment.groupBy.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    expect((await getGroupLeaderboard("u1", "g1", {}, NOW)).months).toEqual([1]);
  });
});
