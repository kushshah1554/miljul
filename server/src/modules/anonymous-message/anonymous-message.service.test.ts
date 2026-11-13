import { beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "./anonymous-message.service";

const USER_ID = "cuser00000000000000001";
const GROUP_ID = "cgroup0000000000000001";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    group: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    groupMember: { findUnique: vi.fn() },
    anonymousMessage: { create: vi.fn() },
    anonymousMessageQuota: { deleteMany: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (work) => work(prismaMock));
  prismaMock.groupMember.findUnique.mockResolvedValue({ role: "MEMBER" });
  prismaMock.group.findUnique.mockResolvedValue({ isArchived: false });
  prismaMock.group.findUniqueOrThrow.mockResolvedValue({ timezone: "Asia/Kathmandu" });
  prismaMock.anonymousMessage.create.mockResolvedValue({ id: "m1" });
});

describe("anonymous message daily limit", () => {
  it("allows up to the limit and stores no user on the message", async () => {
    prismaMock.anonymousMessageQuota.upsert.mockResolvedValue({ count: service.DAILY_MESSAGE_LIMIT });

    await service.createMessage(USER_ID, GROUP_ID, { content: "hi" });

    const { data } = prismaMock.anonymousMessage.create.mock.calls[0][0];
    expect(data).toEqual({ groupId: GROUP_ID, content: "hi" });
    // Old days' counters are dropped so no posting history is kept.
    const { where } = prismaMock.anonymousMessageQuota.deleteMany.mock.calls[0][0];
    expect(where).toMatchObject({ userId: USER_ID, groupId: GROUP_ID, day: { not: expect.any(String) } });
  });

  it("rejects the post over the limit with 429 and creates nothing", async () => {
    prismaMock.anonymousMessageQuota.upsert.mockResolvedValue({
      count: service.DAILY_MESSAGE_LIMIT + 1,
    });

    await expect(
      service.createMessage(USER_ID, GROUP_ID, { content: "hi" }),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(prismaMock.anonymousMessage.create).not.toHaveBeenCalled();
  });
});
