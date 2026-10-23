import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import * as balanceService from "./balance.service";
import { computeSettlements } from "./balance.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_ID = "cgroup0000000000000001";
const OTHER_GROUP_ID = "cgroup0000000000000002";
const RAM_ID = "cuser00000000000000001";
const SITA_ID = "cuser00000000000000002";
const HARI_ID = "cuser00000000000000003";
const GITA_ID = "cuser00000000000000004";
const SAM_ID = "cuser00000000000000005";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    group: {
      findFirst: vi.fn(),
    },
    groupMember: {
      findMany: vi.fn(),
    },
    expense: {
      groupBy: vi.fn(),
    },
    expenseSplit: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

// ─── Test helpers ─────────────────────────────────────────────────────────────

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error("Expected promise to reject, but it resolved");
}

/**
 * Stubs the membership check (findFirst) and all three aggregation calls.
 *
 * @param members  - array of { userId, name, email }
 * @param paid     - array of { paidById, amount } — matches Expense.groupBy rows
 * @param shares   - array of { userId, amount }  — matches ExpenseSplit.groupBy rows
 */
function stubBalanceQueries(
  members: Array<{ userId: string; name: string; email: string }>,
  paid: Array<{ paidById: string; amount: string }>,
  shares: Array<{ userId: string; amount: string }>,
) {
  // Membership check for the caller.
  prismaMock.group.findFirst.mockResolvedValue({ id: GROUP_ID });

  // Current group members.
  prismaMock.groupMember.findMany.mockResolvedValue(
    members.map((m) => ({
      userId: m.userId,
      user: { id: m.userId, name: m.name, email: m.email },
    })),
  );

  // Aggregated totals.
  prismaMock.expense.groupBy.mockResolvedValue(
    paid.map((p) => ({
      paidById: p.paidById,
      _sum: { amount: new Prisma.Decimal(p.amount) },
    })),
  );

  prismaMock.expenseSplit.groupBy.mockResolvedValue(
    shares.map((s) => ({
      userId: s.userId,
      _sum: { amount: new Prisma.Decimal(s.amount) },
    })),
  );
}

const fiveMembers = [
  { userId: RAM_ID, name: "Ram", email: "ram@test.com" },
  { userId: SITA_ID, name: "Sita", email: "sita@test.com" },
  { userId: HARI_ID, name: "Hari", email: "hari@test.com" },
  { userId: GITA_ID, name: "Gita", email: "gita@test.com" },
  { userId: SAM_ID, name: "Sam", email: "sam@test.com" },
];

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── getGroupBalances ──────────────────────────────────────────────────────────

describe("getGroupBalances", () => {
  it("returns a positive balance for the member who paid more than their share", async () => {
    // Ram pays Rs 500 for a five-way split of Rs 100 each.
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const ram = balances.find((b) => b.userId === RAM_ID)!;
    expect(ram.totalPaid).toBe("500.00");
    expect(ram.totalShares).toBe("100.00");
    expect(ram.netBalance).toBe("400.00"); // positive — owed money
  });

  it("returns a negative balance for members whose shares exceed their payments", async () => {
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    for (const name of [SITA_ID, HARI_ID, GITA_ID, SAM_ID]) {
      const b = balances.find((b) => b.userId === name)!;
      expect(b.totalPaid).toBe("0.00");
      expect(b.totalShares).toBe("100.00");
      expect(b.netBalance).toBe("-100.00"); // owes money
    }
  });

  it("returns zero balance for a member with no expenses or shares", async () => {
    // Only Ram has any activity; Sam has none.
    stubBalanceQueries(
      [
        { userId: RAM_ID, name: "Ram", email: "ram@test.com" },
        { userId: SAM_ID, name: "Sam", email: "sam@test.com" },
      ],
      [{ paidById: RAM_ID, amount: "100.00" }],
      [{ userId: RAM_ID, amount: "100.00" }],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const sam = balances.find((b) => b.userId === SAM_ID)!;
    expect(sam.totalPaid).toBe("0.00");
    expect(sam.totalShares).toBe("0.00");
    expect(sam.netBalance).toBe("0.00");
  });

  it("returns zero balances for all members when the group has no expenses", async () => {
    stubBalanceQueries(fiveMembers, [], []);

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    expect(balances).toHaveLength(5);
    for (const b of balances) {
      expect(b.totalPaid).toBe("0.00");
      expect(b.totalShares).toBe("0.00");
      expect(b.netBalance).toBe("0.00");
    }
  });

  it("all member balances sum to zero for valid fully-included expenses", async () => {
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const sum = balances.reduce(
      (acc, b) => acc.add(new Prisma.Decimal(b.netBalance)),
      new Prisma.Decimal(0),
    );
    expect(sum.toFixed(2)).toBe("0.00");
  });

  it("accounts for the payer's own split correctly", async () => {
    // Ram pays Rs 300; the split is Ram Rs 200, Sita Rs 100.
    // Ram's net = 300 - 200 = +100; Sita's net = 0 - 100 = -100.
    stubBalanceQueries(
      [
        { userId: RAM_ID, name: "Ram", email: "ram@test.com" },
        { userId: SITA_ID, name: "Sita", email: "sita@test.com" },
      ],
      [{ paidById: RAM_ID, amount: "300.00" }],
      [
        { userId: RAM_ID, amount: "200.00" },
        { userId: SITA_ID, amount: "100.00" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const ram = balances.find((b) => b.userId === RAM_ID)!;
    const sita = balances.find((b) => b.userId === SITA_ID)!;
    expect(ram.netBalance).toBe("100.00");
    expect(sita.netBalance).toBe("-100.00");
  });

  it("does not include expenses from another group (scoped queries)", async () => {
    // We verify the service calls Prisma with the correct groupId filter.
    stubBalanceQueries(
      [{ userId: RAM_ID, name: "Ram", email: "ram@test.com" }],
      [{ paidById: RAM_ID, amount: "500.00" }],
      [{ userId: RAM_ID, amount: "500.00" }],
    );

    await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    // groupBy on Expense must include { groupId } — not OTHER_GROUP_ID.
    const expenseGroupByCall = prismaMock.expense.groupBy.mock.calls[0][0] as {
      where: { groupId: string };
    };
    expect(expenseGroupByCall.where.groupId).toBe(GROUP_ID);
    expect(expenseGroupByCall.where.groupId).not.toBe(OTHER_GROUP_ID);

    // groupBy on ExpenseSplit must scope to the same group via the relation.
    const splitGroupByCall = prismaMock.expenseSplit.groupBy.mock.calls[0][0] as {
      where: { expense: { groupId: string } };
    };
    expect(splitGroupByCall.where.expense.groupId).toBe(GROUP_ID);
  });

  it("returns 404 for a non-member caller", async () => {
    prismaMock.group.findFirst.mockResolvedValue(null);

    const error = await catchError(
      balanceService.getGroupBalances("cuser_outsider_0000001", GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.groupMember.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown group id", async () => {
    prismaMock.group.findFirst.mockResolvedValue(null);

    const error = await catchError(
      balanceService.getGroupBalances(RAM_ID, "cgroup_unknown_0000001"),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("handles decimal amounts without floating-point errors", async () => {
    // Rs 10.10 split three ways: 3.37 + 3.37 + 3.36 = 10.10 exactly.
    stubBalanceQueries(
      [
        { userId: RAM_ID, name: "Ram", email: "ram@test.com" },
        { userId: SITA_ID, name: "Sita", email: "sita@test.com" },
        { userId: HARI_ID, name: "Hari", email: "hari@test.com" },
      ],
      [{ paidById: RAM_ID, amount: "10.10" }],
      [
        { userId: RAM_ID, amount: "3.37" },
        { userId: SITA_ID, amount: "3.37" },
        { userId: HARI_ID, amount: "3.36" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const ram = balances.find((b) => b.userId === RAM_ID)!;
    // 10.10 - 3.37 = 6.73 exactly (not a floating-point approximation)
    expect(ram.netBalance).toBe("6.73");
  });

  it("handles a member with many expenses (amounts aggregate correctly)", async () => {
    // Ram paid three separate expenses.
    stubBalanceQueries(
      [
        { userId: RAM_ID, name: "Ram", email: "ram@test.com" },
        { userId: SITA_ID, name: "Sita", email: "sita@test.com" },
      ],
      // groupBy returns one aggregated row per payer.
      [{ paidById: RAM_ID, amount: "750.00" }],
      [
        { userId: RAM_ID, amount: "375.00" },
        { userId: SITA_ID, amount: "375.00" },
      ],
    );

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    const ram = balances.find((b) => b.userId === RAM_ID)!;
    expect(ram.totalPaid).toBe("750.00");
    expect(ram.totalShares).toBe("375.00");
    expect(ram.netBalance).toBe("375.00");
  });

  it("includes all current group members even those with no activity", async () => {
    stubBalanceQueries(fiveMembers, [], []);

    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);

    expect(balances).toHaveLength(5);
    const ids = balances.map((b) => b.userId);
    expect(ids).toContain(RAM_ID);
    expect(ids).toContain(SAM_ID);
  });
});

// ─── getMyGroupBalance ─────────────────────────────────────────────────────────

describe("getMyGroupBalance", () => {
  it("returns only the authenticated user's balance", async () => {
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );

    const result = await balanceService.getMyGroupBalance(SITA_ID, GROUP_ID);

    // Returns only Sita's balance — no other members' data.
    expect(result.userId).toBe(SITA_ID);
    expect(result.netBalance).toBe("-100.00");
    expect(result.totalPaid).toBe("0.00");
    expect(result.totalShares).toBe("100.00");
    // No balances array in the response.
    expect(result).not.toHaveProperty("balances");
  });

  it("returns 404 for a non-member", async () => {
    prismaMock.group.findFirst.mockResolvedValue(null);

    const error = await catchError(
      balanceService.getMyGroupBalance("cuser_outsider_0000001", GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("uses the same calculation logic as the all-balances endpoint (shared formula)", async () => {
    // Run both endpoints with identical stubs.
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );

    const myResult = await balanceService.getMyGroupBalance(RAM_ID, GROUP_ID);

    // Reset mocks and run the all-balances endpoint.
    vi.resetAllMocks();
    stubBalanceQueries(
      fiveMembers,
      [{ paidById: RAM_ID, amount: "500.00" }],
      [
        { userId: RAM_ID, amount: "100.00" },
        { userId: SITA_ID, amount: "100.00" },
        { userId: HARI_ID, amount: "100.00" },
        { userId: GITA_ID, amount: "100.00" },
        { userId: SAM_ID, amount: "100.00" },
      ],
    );
    const { balances } = await balanceService.getGroupBalances(RAM_ID, GROUP_ID);
    const ramFromAll = balances.find((b) => b.userId === RAM_ID)!;

    expect(myResult.netBalance).toBe(ramFromAll.netBalance);
    expect(myResult.totalPaid).toBe(ramFromAll.totalPaid);
    expect(myResult.totalShares).toBe(ramFromAll.totalShares);
  });
});

// ─── computeSettlements (pure function) ───────────────────────────────────────

describe("computeSettlements", () => {
  function makeBalance(userId: string, name: string, net: string) {
    const netDec = new Prisma.Decimal(net);
    const paid = netDec.greaterThan(0) ? net : "0.00";
    const shares = netDec.lessThan(0) ? netDec.abs().toFixed(2) : "0.00";
    return { userId, name, email: `${name}@test.com`, totalPaid: paid, totalShares: shares, netBalance: net };
  }

  it("produces no suggestions when all balances are zero", () => {
    const suggestions = computeSettlements([
      makeBalance(RAM_ID, "Ram", "0.00"),
      makeBalance(SITA_ID, "Sita", "0.00"),
    ]);
    expect(suggestions).toHaveLength(0);
  });

  it("settles a simple two-person case correctly", () => {
    const suggestions = computeSettlements([
      makeBalance(RAM_ID, "Ram", "100.00"),
      makeBalance(SITA_ID, "Sita", "-100.00"),
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].fromUserId).toBe(SITA_ID);
    expect(suggestions[0].toUserId).toBe(RAM_ID);
    expect(suggestions[0].amount).toBe("100.00");
  });

  it("settles the five-member grocery example with four suggestions", () => {
    const suggestions = computeSettlements([
      makeBalance(RAM_ID, "Ram", "400.00"),
      makeBalance(SITA_ID, "Sita", "-100.00"),
      makeBalance(HARI_ID, "Hari", "-100.00"),
      makeBalance(GITA_ID, "Gita", "-100.00"),
      makeBalance(SAM_ID, "Sam", "-100.00"),
    ]);

    // All four debtors pay Ram Rs 100 each.
    expect(suggestions).toHaveLength(4);
    const total = suggestions.reduce(
      (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
      new Prisma.Decimal(0),
    );
    expect(total.toFixed(2)).toBe("400.00");
    for (const s of suggestions) {
      expect(s.toUserId).toBe(RAM_ID);
      expect(s.amount).toBe("100.00");
    }
  });

  it("never overpays a creditor when one debtor covers multiple creditors", () => {
    // Sita owes Rs 200: Rs 100 to Ram, Rs 100 to Hari.
    const suggestions = computeSettlements([
      makeBalance(RAM_ID, "Ram", "100.00"),
      makeBalance(HARI_ID, "Hari", "100.00"),
      makeBalance(SITA_ID, "Sita", "-200.00"),
    ]);

    // Sum of suggested payments equals Sita's total debt.
    const total = suggestions.reduce(
      (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
      new Prisma.Decimal(0),
    );
    expect(total.toFixed(2)).toBe("200.00");

    // No individual suggestion exceeds any creditor's balance.
    for (const s of suggestions) {
      expect(parseFloat(s.amount)).toBeLessThanOrEqual(100);
    }
  });

  it("balances all creditors and debtors without leftover", () => {
    const balances = [
      makeBalance(RAM_ID, "Ram", "300.00"),
      makeBalance(SITA_ID, "Sita", "50.00"),
      makeBalance(HARI_ID, "Hari", "-200.00"),
      makeBalance(GITA_ID, "Gita", "-150.00"),
    ];

    const suggestions = computeSettlements(balances);

    // Confirm total payments equal total credits.
    const totalPaid = suggestions.reduce(
      (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
      new Prisma.Decimal(0),
    );
    expect(totalPaid.toFixed(2)).toBe("350.00");
  });
});
