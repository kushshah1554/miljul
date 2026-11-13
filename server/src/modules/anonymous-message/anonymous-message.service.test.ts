import { beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "./anonymous-message.service";

const USER_ID = "cuser00000000000000001";
const GROUP_ID = "cgroup0000000000000001";
const OTHER_ID = "cuser00000000000000002";
const MSG_ID = "cmsg000000000000000001";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    group: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    groupMember: { findUnique: vi.fn() },
    anonymousMessage: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
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
  prismaMock.anonymousMessage.create.mockResolvedValue({ id: MSG_ID });
  prismaMock.anonymousMessage.update.mockImplementation(async ({ data }) => ({
    id: MSG_ID,
    content: "hi",
    createdAt: new Date(),
    authorHash: data.authorHash,
  }));
});

describe("anonymous message daily limit", () => {
  it("allows up to the limit and stores no user on the message", async () => {
    prismaMock.anonymousMessageQuota.upsert.mockResolvedValue({ count: service.DAILY_MESSAGE_LIMIT });

    const message = await service.createMessage(USER_ID, GROUP_ID, { content: "hi" });

    const { data } = prismaMock.anonymousMessage.create.mock.calls[0][0];
    expect(data).toEqual({ groupId: GROUP_ID, content: "hi" });
    // Only a keyed hash is stored, never the user id, and it isn't returned.
    const { data: update } = prismaMock.anonymousMessage.update.mock.calls[0][0];
    expect(update.authorHash).not.toContain(USER_ID);
    expect(message).toEqual(expect.objectContaining({ isMine: true }));
    expect(message).not.toHaveProperty("authorHash");
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

describe("deleting anonymous messages", () => {
  const ownMessage = () => ({ id: MSG_ID, authorHash: service.hashAuthor(USER_ID, MSG_ID) });

  it("lets a member delete their own message", async () => {
    prismaMock.anonymousMessage.findFirst.mockResolvedValue(ownMessage());
    await service.deleteMessage(USER_ID, GROUP_ID, MSG_ID);
    expect(prismaMock.anonymousMessage.deleteMany).toHaveBeenCalled();
  });

  it("stops a member deleting someone else's message", async () => {
    prismaMock.anonymousMessage.findFirst.mockResolvedValue(ownMessage());
    await expect(service.deleteMessage(OTHER_ID, GROUP_ID, MSG_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prismaMock.anonymousMessage.deleteMany).not.toHaveBeenCalled();
  });

  it("lets the owner delete anyone's message, including ones with no hash", async () => {
    prismaMock.groupMember.findUnique.mockResolvedValue({ role: "OWNER" });
    prismaMock.anonymousMessage.findFirst.mockResolvedValue({ id: MSG_ID, authorHash: null });
    await service.deleteMessage(OTHER_ID, GROUP_ID, MSG_ID);
    expect(prismaMock.anonymousMessage.deleteMany).toHaveBeenCalled();
  });
});
