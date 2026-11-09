import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChoreStatus, GroupRole, Prisma } from "../../generated/prisma/client";
import { resetChoresForGroupArchive, restartChoresForGroupRestore } from "./chore.engine";
import { archiveChore, restoreChore, setAvailability } from "./chore.service";

const { tx } = vi.hoisted(() => ({
  tx: {
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn(), findMany: vi.fn() },
    chore: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    choreAssignment: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    choreCycle: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    choreParticipant: { findMany: vi.fn() },
    choreFine: { create: vi.fn() },
  },
}));

vi.mock("../../utils/prisma", () => ({ prisma: {} }));
vi.mock("../../utils/transaction", () => ({
  runSerializable: (work: (client: typeof tx) => unknown) => work(tx),
}));

const choreRow = (status: ChoreStatus) => ({
  id: "chore",
  name: "Dishes",
  status,
  frozenAt: null,
  currentAssignmentId: null,
  intervalDays: 7,
  deadlineMinutes: 690,
  finePerMember: new Prisma.Decimal(20),
});

beforeEach(() => {
  vi.resetAllMocks();
  tx.groupMember.findUnique.mockResolvedValue({
    role: GroupRole.OWNER,
    group: { isArchived: false, timezone: "UTC" },
  });
  // catchUpGroup finds nothing to do unless a test says otherwise.
  tx.chore.findMany.mockResolvedValue([]);
  tx.choreAssignment.findMany.mockResolvedValue([]);
  tx.chore.findUniqueOrThrow.mockImplementation(async () => ({
    ...choreRow(ChoreStatus.ACTIVE),
    description: null,
    currentAssignment: null,
  }));
});

describe("archiveChore", () => {
  it("refuses a paused chore", async () => {
    tx.chore.findFirst.mockResolvedValue(choreRow(ChoreStatus.PAUSED));

    await expect(archiveChore("owner", "group", "chore", {})).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(tx.choreAssignment.updateMany).not.toHaveBeenCalled();
  });

  it("waives open turns with the owner's reason, ends the cycle and adds no fine", async () => {
    tx.chore.findFirst.mockResolvedValue(choreRow(ChoreStatus.ACTIVE));

    await archiveChore("owner", "group", "chore", { reason: "Bought a dishwasher" });

    expect(tx.choreAssignment.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "WAIVED",
      closeReason: "Chore archived: Bought a dishwasher",
    });
    expect(tx.choreCycle.updateMany.mock.calls[0][0].where).toEqual({
      choreId: "chore",
      endedAt: null,
    });
    expect(tx.choreFine.create).not.toHaveBeenCalled();
  });
});

describe("restoreChore", () => {
  it("gives the first turn to the first member of the original queue", async () => {
    tx.chore.findFirst.mockResolvedValue(choreRow(ChoreStatus.ARCHIVED));
    tx.choreParticipant.findMany.mockResolvedValue([
      { userId: "a", unavailableUntil: null },
      { userId: "b", unavailableUntil: null },
      { userId: "c", unavailableUntil: null },
    ]);
    // Archive ended the cycle: no open one, and the last ended one was number 4.
    tx.choreCycle.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ number: 4 });
    tx.choreCycle.create.mockResolvedValue({
      id: "cycle",
      number: 5,
      order: ["a", "b", "c"],
      startedAt: new Date(),
      endedAt: null,
    });
    tx.choreAssignment.create.mockResolvedValue({ id: "turn" });

    await restoreChore("owner", "group", "chore");

    expect(tx.choreCycle.create.mock.calls[0][0].data).toMatchObject({
      number: 5,
      order: ["a", "b", "c"],
    });
    expect(tx.choreAssignment.create.mock.calls[0][0].data.userId).toBe("a");
  });
});

describe("group archive / restore", () => {
  it("archive waives open turns of every non-archived chore and ends their cycles", async () => {
    const now = new Date();
    await resetChoresForGroupArchive(tx as never, "group", "owner", now);

    const notArchived = { groupId: "group", status: { not: ChoreStatus.ARCHIVED } };
    expect(tx.choreAssignment.updateMany.mock.calls[0][0]).toMatchObject({
      where: { chore: notArchived },
      data: { status: "WAIVED", closeReason: "Group archived", closedById: "owner" },
    });
    expect(tx.choreCycle.updateMany.mock.calls[0][0]).toEqual({
      where: { chore: notArchived, endedAt: null },
      data: { endedAt: now },
    });
    expect(tx.chore.updateMany.mock.calls[0][0]).toEqual({
      where: notArchived,
      data: { currentAssignmentId: null },
    });
  });

  it("restore gives a paused chore a fresh first turn but keeps it frozen", async () => {
    const now = new Date();
    tx.chore.findMany
      .mockResolvedValueOnce([{ id: "chore" }]) // paused chores
      .mockResolvedValueOnce([]); // catchUpGroup: running chores
    tx.chore.findUniqueOrThrow.mockResolvedValue(choreRow(ChoreStatus.PAUSED));
    tx.choreParticipant.findMany.mockResolvedValue([
      { userId: "a", unavailableUntil: null },
      { userId: "b", unavailableUntil: null },
    ]);
    tx.choreCycle.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ number: 2 });
    tx.choreCycle.create.mockResolvedValue({
      id: "cycle",
      number: 3,
      order: ["a", "b"],
      startedAt: now,
      endedAt: null,
    });
    tx.choreAssignment.create.mockResolvedValue({ id: "turn" });

    await restartChoresForGroupRestore(tx as never, "group", "UTC", now);

    expect(tx.chore.findMany.mock.calls[0][0].where).toEqual({
      groupId: "group",
      status: ChoreStatus.PAUSED,
    });
    expect(tx.choreAssignment.create.mock.calls[0][0].data.userId).toBe("a");
    const updates = tx.chore.update.mock.calls.map((c) => c[0].data);
    expect(updates[0]).toEqual({ frozenAt: null });
    expect(updates.at(-1)).toEqual({ frozenAt: now });
    // Never flipped out of PAUSED
    expect(updates.some((d) => "status" in d)).toBe(false);
  });
});

describe("setAvailability", () => {
  it("is blocked on an archived chore", async () => {
    tx.chore.findFirst.mockResolvedValue(choreRow(ChoreStatus.ARCHIVED));

    await expect(
      setAvailability("owner", "group", "chore", "a", { unavailableUntil: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
