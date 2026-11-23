import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import { getDashboard } from "./dashboard.service";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    groupMember: { count: vi.fn() },
    expense: { aggregate: vi.fn() },
    choreFineShare: { aggregate: vi.fn() },
    choreAssignment: { count: vi.fn(), fields: { deadlineAt: "deadlineAt" } },
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
