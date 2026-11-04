import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChoreStatus, GroupRole, Prisma } from "../../generated/prisma/client";
import { archiveChore, restoreChore, setAvailability } from "./chore.service";

const { tx } = vi.hoisted(() => ({
  tx: {
    group: { findUnique: vi.fn() },
    groupMember: { findUnique: vi.fn(), findMany: vi.fn() },
    chore: { findFirst: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
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

describe("setAvailability", () => {
  it("is blocked on an archived chore", async () => {
    tx.chore.findFirst.mockResolvedValue(choreRow(ChoreStatus.ARCHIVED));

    await expect(
      setAvailability("owner", "group", "chore", "a", { unavailableUntil: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
