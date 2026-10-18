import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, GroupRole } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import * as expenseService from "./expense.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const OWNER_ID = "cuser00000000000000001";
const MEMBER_ID = "cuser00000000000000002";
const OUTSIDER_ID = "cuser00000000000000003";
const GROUP_ID = "cgroup0000000000000001";
const EXPENSE_ID = "cexp000000000000000001";

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    group: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    groupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    expense: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    expenseSplit: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error("Expected promise to reject, but it resolved");
}

/** Returns a tx-like object that all service calls use inside $transaction. */
function makeTx(overrides: Partial<typeof prismaMock> = {}): typeof prismaMock {
  return { ...prismaMock, ...overrides };
}

/** Makes prismaMock.$transaction delegate to the callback with the mock itself. */
function useTransactionPassthrough() {
  prismaMock.$transaction.mockImplementation(
    async (work: (tx: typeof prismaMock) => Promise<unknown>) => work(prismaMock),
  );
}

function makeSplits(count = 2, amount = "50.00") {
  const ids = [OWNER_ID, MEMBER_ID, "cuser00000000000000004", "cuser00000000000000005"];
  return ids.slice(0, count).map((userId) => ({ userId, amount }));
}

function makeExpenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXPENSE_ID,
    description: "Groceries",
    amount: new Prisma.Decimal("100.00"),
    paidById: OWNER_ID,
    groupId: GROUP_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    paidBy: { id: OWNER_ID, name: "Owner", email: "owner@test.com" },
    splits: [
      { id: "csplit000000000000001", userId: OWNER_ID, amount: new Prisma.Decimal("50.00"), user: { id: OWNER_ID, name: "Owner", email: "owner@test.com" } },
      { id: "csplit000000000000002", userId: MEMBER_ID, amount: new Prisma.Decimal("50.00"), user: { id: MEMBER_ID, name: "Member", email: "member@test.com" } },
    ],
    ...overrides,
  };
}

/** Stubs the membership check and group-active check for the tx. */
function stubMemberAndActiveGroup(role: GroupRole) {
  prismaMock.groupMember.findUnique.mockResolvedValue({ role });
  prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
  prismaMock.groupMember.findMany.mockResolvedValue([
    { userId: OWNER_ID },
    { userId: MEMBER_ID },
  ]);
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── createExpense ─────────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("creates an expense with splits atomically and returns 201 data", async () => {
    useTransactionPassthrough();
    stubMemberAndActiveGroup(GroupRole.MEMBER);
    prismaMock.expense.create.mockResolvedValue(makeExpenseRow());

    const result = await expenseService.createExpense(OWNER_ID, GROUP_ID, {
      description: "Groceries",
      amount: "100.00",
      paidById: OWNER_ID,
      splits: makeSplits(2, "50.00"),
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.expense.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(EXPENSE_ID);
    expect(result.description).toBe("Groceries");
  });

  it("rejects when the caller is not a group member (404)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue(null); // not a member

    const error = await catchError(
      expenseService.createExpense(OUTSIDER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OWNER_ID,
        splits: makeSplits(2, "50.00"),
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("rejects when the payer is not a group member (400)", async () => {
    useTransactionPassthrough();
    // Caller is a member; payer lookup returns null (not a member).
    prismaMock.groupMember.findUnique
      .mockResolvedValueOnce({ role: GroupRole.MEMBER }) // caller membership
      .mockResolvedValueOnce(null); // payer membership
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });

    const error = await catchError(
      expenseService.createExpense(OWNER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OUTSIDER_ID,
        splits: makeSplits(2, "50.00"),
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/payer/i);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("rejects when a split participant is not a group member (400)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique
      .mockResolvedValueOnce({ role: GroupRole.MEMBER }) // caller
      .mockResolvedValueOnce({ userId: OWNER_ID }); // payer check passes
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    // findMany for participant check returns only one member (OUTSIDER_ID missing)
    prismaMock.groupMember.findMany.mockResolvedValue([{ userId: OWNER_ID }]);

    const error = await catchError(
      expenseService.createExpense(OWNER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OWNER_ID,
        splits: [
          { userId: OWNER_ID, amount: "50.00" },
          { userId: OUTSIDER_ID, amount: "50.00" },
        ],
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/not a member/i);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("rejects when split total does not equal expense amount (400)", async () => {
    // Validation runs before the transaction, so no mock needed.
    const error = await catchError(
      expenseService.createExpense(OWNER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OWNER_ID,
        splits: [
          { userId: OWNER_ID, amount: "60.00" },
          { userId: MEMBER_ID, amount: "30.00" }, // sum = 90, not 100
        ],
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/split/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects duplicate split participants (400)", async () => {
    const error = await catchError(
      expenseService.createExpense(OWNER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OWNER_ID,
        splits: [
          { userId: OWNER_ID, amount: "50.00" },
          { userId: OWNER_ID, amount: "50.00" }, // duplicate
        ],
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/duplicate/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects expense creation when the group is archived (409)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: true }); // archived

    const error = await catchError(
      expenseService.createExpense(OWNER_ID, GROUP_ID, {
        description: "Groceries",
        amount: "100.00",
        paidById: OWNER_ID,
        splits: makeSplits(2, "50.00"),
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });
});

// ─── listExpenses ──────────────────────────────────────────────────────────────

describe("listExpenses", () => {
  it("returns a paginated list for a valid member", async () => {
    prismaMock.group.findFirst.mockResolvedValue({ id: GROUP_ID });
    prismaMock.expense.findMany.mockResolvedValue([makeExpenseRow()]);
    prismaMock.expense.count.mockResolvedValue(1);

    const result = await expenseService.listExpenses(OWNER_ID, GROUP_ID, {
      page: 1,
      limit: 20,
    });

    expect(result.expenses).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("returns 404 for a non-member", async () => {
    prismaMock.group.findFirst.mockResolvedValue(null);

    const error = await catchError(
      expenseService.listExpenses(OUTSIDER_ID, GROUP_ID, { page: 1, limit: 20 }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.findMany).not.toHaveBeenCalled();
  });
});

// ─── getExpenseById ────────────────────────────────────────────────────────────

describe("getExpenseById", () => {
  it("returns the expense to a valid member", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
    prismaMock.expense.findFirst.mockResolvedValue(makeExpenseRow());

    const expense = await expenseService.getExpenseById(
      OWNER_ID,
      GROUP_ID,
      EXPENSE_ID,
    );

    expect(expense.id).toBe(EXPENSE_ID);
    expect(prismaMock.expense.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: EXPENSE_ID, groupId: GROUP_ID } }),
    );
  });

  it("returns 404 when the expense does not belong to the group", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
    prismaMock.expense.findFirst.mockResolvedValue(null);

    const error = await catchError(
      expenseService.getExpenseById(OWNER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it("returns 404 for a non-member", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue(null);

    const error = await catchError(
      expenseService.getExpenseById(OUTSIDER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.findFirst).not.toHaveBeenCalled();
  });
});

// ─── updateExpense ─────────────────────────────────────────────────────────────

describe("updateExpense", () => {
  it("allows an OWNER to update description only", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue({
      id: EXPENSE_ID,
      amount: new Prisma.Decimal("100.00"),
      splits: [],
    });
    const updated = makeExpenseRow({ description: "Updated desc" });
    prismaMock.expense.update.mockResolvedValue(updated);

    const result = await expenseService.updateExpense(
      OWNER_ID,
      GROUP_ID,
      EXPENSE_ID,
      { description: "Updated desc" },
    );

    expect(prismaMock.expense.update).toHaveBeenCalledTimes(1);
    expect(result.description).toBe("Updated desc");
    // Splits should NOT be touched when not in input.
    expect(prismaMock.expenseSplit.deleteMany).not.toHaveBeenCalled();
  });

  it("forbids a plain MEMBER from updating (403)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });

    const error = await catchError(
      expenseService.updateExpense(MEMBER_ID, GROUP_ID, EXPENSE_ID, {
        description: "Not allowed",
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(prismaMock.expense.update).not.toHaveBeenCalled();
  });

  it("rejects when amount changes but splits are omitted and amounts differ (400)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue({
      id: EXPENSE_ID,
      amount: new Prisma.Decimal("100.00"),
      splits: [],
    });

    const error = await catchError(
      expenseService.updateExpense(OWNER_ID, GROUP_ID, EXPENSE_ID, {
        amount: "200.00", // changed; no splits provided
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toMatch(/splits/i);
  });

  it("atomically replaces splits when both amount and splits are provided", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue({
      id: EXPENSE_ID,
      amount: new Prisma.Decimal("100.00"),
      splits: [],
    });
    prismaMock.groupMember.findMany.mockResolvedValue([
      { userId: OWNER_ID },
      { userId: MEMBER_ID },
    ]);
    prismaMock.expenseSplit.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.expenseSplit.createMany.mockResolvedValue({ count: 2 });
    prismaMock.expense.update.mockResolvedValue(makeExpenseRow({ amount: new Prisma.Decimal("200.00") }));

    await expenseService.updateExpense(OWNER_ID, GROUP_ID, EXPENSE_ID, {
      amount: "200.00",
      splits: makeSplits(2, "100.00"),
    });

    expect(prismaMock.expenseSplit.deleteMany).toHaveBeenCalledWith({
      where: { expenseId: EXPENSE_ID },
    });
    expect(prismaMock.expenseSplit.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.expense.update).toHaveBeenCalledTimes(1);
  });

  it("rejects when updated splits do not sum to the expense amount (400)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue({
      id: EXPENSE_ID,
      amount: new Prisma.Decimal("100.00"),
      splits: [],
    });

    const error = await catchError(
      expenseService.updateExpense(OWNER_ID, GROUP_ID, EXPENSE_ID, {
        splits: [
          { userId: OWNER_ID, amount: "40.00" },
          { userId: MEMBER_ID, amount: "40.00" }, // sum = 80, not 100
        ],
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
  });

  it("returns 404 when the expense does not exist in the group", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue(null);

    const error = await catchError(
      expenseService.updateExpense(OWNER_ID, GROUP_ID, EXPENSE_ID, {
        description: "New desc",
      }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });
});

// ─── deleteExpense ─────────────────────────────────────────────────────────────

describe("deleteExpense", () => {
  it("allows an OWNER to delete an expense", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue({ id: EXPENSE_ID });
    prismaMock.expense.delete.mockResolvedValue({ id: EXPENSE_ID });

    await expenseService.deleteExpense(OWNER_ID, GROUP_ID, EXPENSE_ID);

    expect(prismaMock.expense.delete).toHaveBeenCalledWith({
      where: { id: EXPENSE_ID },
    });
  });

  it("forbids a MEMBER from deleting (403)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.MEMBER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });

    const error = await catchError(
      expenseService.deleteExpense(MEMBER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when expense does not belong to the group", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
    prismaMock.expense.findFirst.mockResolvedValue(null);

    const error = await catchError(
      expenseService.deleteExpense(OWNER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-member caller", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue(null);

    const error = await catchError(
      expenseService.deleteExpense(OUTSIDER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });

  it("rejects deletion in an archived group (409)", async () => {
    useTransactionPassthrough();
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: GroupRole.OWNER });
    prismaMock.group.findUnique.mockResolvedValue({ isArchived: true });

    const error = await catchError(
      expenseService.deleteExpense(OWNER_ID, GROUP_ID, EXPENSE_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });
});

// ─── getMyExpenses ─────────────────────────────────────────────────────────────

describe("getMyExpenses", () => {
  it("returns expenses where the user is payer or participant without duplicates", async () => {
    prismaMock.group.findFirst.mockResolvedValue({ id: GROUP_ID });
    prismaMock.expense.findMany.mockResolvedValue([makeExpenseRow()]);
    prismaMock.expense.count.mockResolvedValue(1);

    const result = await expenseService.getMyExpenses(OWNER_ID, GROUP_ID, {
      page: 1,
      limit: 20,
    });

    expect(result.expenses).toHaveLength(1);
    // Verify the OR condition is passed (paidById OR split participant).
    expect(prismaMock.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { paidById: OWNER_ID },
            { splits: { some: { userId: OWNER_ID } } },
          ]),
        }),
      }),
    );
  });

  it("returns 404 for a non-member", async () => {
    prismaMock.group.findFirst.mockResolvedValue(null);

    const error = await catchError(
      expenseService.getMyExpenses(OUTSIDER_ID, GROUP_ID, { page: 1, limit: 20 }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(prismaMock.expense.findMany).not.toHaveBeenCalled();
  });
});

// ─── Validation schema tests ───────────────────────────────────────────────────

import { describe as d, it as test, expect as ex } from "vitest";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} from "./expense.validation";

d("createExpenseSchema", () => {
  test("accepts a valid expense", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "100.00",
      paidById: "cuser00000000000000001",
      splits: [
        { userId: "cuser00000000000000001", amount: "50.00" },
        { userId: "cuser00000000000000002", amount: "50.00" },
      ],
    });
    ex(result.success).toBe(true);
  });

  test("rejects a zero amount", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "0.00",
      paidById: "cuser00000000000000001",
      splits: [{ userId: "cuser00000000000000001", amount: "0.00" }],
    });
    ex(result.success).toBe(false);
  });

  test("rejects a negative amount", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "-10.00",
      paidById: "cuser00000000000000001",
      splits: [{ userId: "cuser00000000000000001", amount: "10.00" }],
    });
    ex(result.success).toBe(false);
  });

  test("rejects amounts with more than 2 decimal places", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "100.999",
      paidById: "cuser00000000000000001",
      splits: [{ userId: "cuser00000000000000001", amount: "100.999" }],
    });
    ex(result.success).toBe(false);
  });

  test("rejects empty splits array", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "100.00",
      paidById: "cuser00000000000000001",
      splits: [],
    });
    ex(result.success).toBe(false);
  });

  test("rejects unknown fields (strict object)", () => {
    const result = createExpenseSchema.safeParse({
      description: "Groceries",
      amount: "100.00",
      paidById: "cuser00000000000000001",
      splits: [{ userId: "cuser00000000000000001", amount: "100.00" }],
      extra: "should fail",
    });
    ex(result.success).toBe(false);
  });
});

d("updateExpenseSchema", () => {
  test("accepts partial update with only description", () => {
    const result = updateExpenseSchema.safeParse({ description: "New desc" });
    ex(result.success).toBe(true);
  });

  test("rejects an empty object", () => {
    const result = updateExpenseSchema.safeParse({});
    ex(result.success).toBe(false);
  });
});

d("listExpensesQuerySchema", () => {
  test("defaults page to 1 and limit to 20", () => {
    const result = listExpensesQuerySchema.parse({});
    ex(result.page).toBe(1);
    ex(result.limit).toBe(20);
  });

  test("rejects limit above 100", () => {
    const result = listExpensesQuerySchema.safeParse({ limit: "101" });
    ex(result.success).toBe(false);
  });

  test("rejects from > to date range", () => {
    const result = listExpensesQuerySchema.safeParse({
      from: "2026-12-01",
      to: "2026-01-01",
    });
    ex(result.success).toBe(false);
  });

  test("accepts valid date range", () => {
    const result = listExpensesQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    ex(result.success).toBe(true);
  });
});
