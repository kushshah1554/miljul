import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, GroupRole } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { GROUP_ARCHIVED_MESSAGE } from "./group.lifecycle";
import * as groupService from "./group.service";

const USER_ID = "cuser00000000000000001";
const GROUP_ID = "cgroup0000000000000001";
const JOIN_CODE = "ABCD2345";

// Codes are generated from an alphabet without I/L/O (see group.service.ts).
const JOIN_CODE_FORMAT = /^[A-HJKMNP-Z2-9]{8}$/;

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    group: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    groupMember: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../utils/prisma", () => ({ prisma: prismaMock }));

/** Agroups.joinCode unique-constraint violation as Prisma raises it. */
function joinCodeCollision(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`joinCode`)",
    { code: "P2002", clientVersion: "test" },
  );
}

/** A [userId, groupId] unique-constraint violation on GroupMember. */
function membershipCollision(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`userId`,`groupId`)",
    { code: "P2002", clientVersion: "test" },
  );
}

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error("Expected promise to reject, but it resolved");
}

function groupScalars(overrides: Record<string, unknown> = {}) {
  return {
    id: GROUP_ID,
    name: "Weekend Trip",
    description: "Cabin",
    joinCode: JOIN_CODE,
    createdById: USER_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    isArchived: false,
    archivedAt: null,
    ...overrides,
  };
}

/**
 * findUnique dispatcher: the join-code lookup asks for { id }, the
 * lifecycle guard asks for { isArchived }.
 */
function mockFindUniqueByCode(group: unknown, isArchived = false) {
  prismaMock.group.findUnique.mockImplementation(
    async (args: { where: Record<string, unknown> }) =>
      args.where.joinCode !== undefined ? group : { isArchived },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("joinGroupByCode", () => {
  it("rejects an unknown join code with 404 and creates nothing", async () => {
    prismaMock.group.findUnique.mockResolvedValueOnce(null);

    const error = await catchError(
      groupService.joinGroupByCode(USER_ID, { joinCode: JOIN_CODE }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Invalid join code");
    expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
  });

  it("rejects joining an archived group with 409", async () => {
    mockFindUniqueByCode({ id: GROUP_ID }, true);

    const error = await catchError(
      groupService.joinGroupByCode(USER_ID, { joinCode: JOIN_CODE }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(GROUP_ARCHIVED_MESSAGE);
    expect(prismaMock.groupMember.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate membership (unique violation) to 409", async () => {
    mockFindUniqueByCode({ id: GROUP_ID }, false);
    prismaMock.groupMember.create.mockRejectedValueOnce(membershipCollision());

    const error = await catchError(
      groupService.joinGroupByCode(USER_ID, { joinCode: JOIN_CODE }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("You are already a member of this group");
    expect(prismaMock.groupMember.create).toHaveBeenCalledTimes(1);
  });

  it("creates a MEMBER membership and returns the group summary", async () => {
    mockFindUniqueByCode({ id: GROUP_ID }, false);
    prismaMock.groupMember.create.mockResolvedValueOnce({ id: "cmem01" });
    prismaMock.group.findFirst.mockResolvedValueOnce({
      ...groupScalars(),
      members: [{ role: GroupRole.MEMBER }],
      _count: { members: 4 },
    });

    const summary = await groupService.joinGroupByCode(USER_ID, {
      joinCode: JOIN_CODE,
    });

    expect(prismaMock.groupMember.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, groupId: GROUP_ID, role: GroupRole.MEMBER },
    });
    expect(summary).toMatchObject({
      id: GROUP_ID,
      joinCode: JOIN_CODE,
      role: GroupRole.MEMBER,
      memberCount: 4,
    });
    // The summary must not carry fields outside the safe group select.
    expect(summary).not.toHaveProperty("members");
    expect(summary).not.toHaveProperty("_count");
  });

  it("rethrows unexpected database errors unchanged", async () => {
    mockFindUniqueByCode({ id: GROUP_ID }, false);
    const dbError = new Error("connection lost");
    prismaMock.groupMember.create.mockRejectedValueOnce(dbError);

    const error = await catchError(
      groupService.joinGroupByCode(USER_ID, { joinCode: JOIN_CODE }),
    );

    expect(error).toBe(dbError);
  });
});

describe("regenerateJoinCode", () => {
  function mockManageableGroup(role: GroupRole, isArchived = false) {
    prismaMock.group.findFirst.mockImplementation(async () => ({
      isArchived,
      members: [{ role }],
    }));
  }

  it("answers 404 for unknown groups and non-members alike", async () => {
    prismaMock.group.findFirst.mockResolvedValueOnce(null);

    const error = await catchError(
      groupService.regenerateJoinCode(USER_ID, GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Group not found");
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  it("forbids a plain MEMBER from regenerating with 403", async () => {
    mockManageableGroup(GroupRole.MEMBER);

    const error = await catchError(
      groupService.regenerateJoinCode(USER_ID, GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe(
      "Only owners and admins can regenerate the join code",
    );
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  it("refuses to rotate the code of an archived group with 409", async () => {
    mockManageableGroup(GroupRole.ADMIN, true);

    const error = await catchError(
      groupService.regenerateJoinCode(USER_ID, GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(GROUP_ARCHIVED_MESSAGE);
    expect(prismaMock.group.update).not.toHaveBeenCalled();
  });

  it.each([GroupRole.OWNER, GroupRole.ADMIN])(
    "lets an %s rotate the code and returns the new one",
    async (role) => {
      let writtenCode: string | undefined;
      mockManageableGroup(role);
      prismaMock.group.findFirst.mockImplementation(async () => ({
        ...groupScalars({ joinCode: writtenCode ?? JOIN_CODE }),
        members: [{ role }],
        _count: { members: 3 },
      }));
      prismaMock.group.update.mockImplementation(
        async (args: { data: { joinCode: string } }) => {
          writtenCode = args.data.joinCode;
          return { id: GROUP_ID };
        },
      );

      const summary = await groupService.regenerateJoinCode(USER_ID, GROUP_ID);

      expect(prismaMock.group.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.group.update).toHaveBeenCalledWith({
        where: { id: GROUP_ID },
        data: { joinCode: expect.any(String) },
        select: { id: true },
      });
      expect(writtenCode).toMatch(JOIN_CODE_FORMAT);
      // The old code is overwritten, so it stops resolving immediately.
      expect(writtenCode).not.toBe(JOIN_CODE);
      expect(summary.joinCode).toBe(writtenCode);
      expect(summary.role).toBe(role);
      expect(summary.memberCount).toBe(3);
    },
  );

  it("retries with a fresh code after a unique-code collision", async () => {
    let writtenCode: string | undefined;
    prismaMock.group.findFirst.mockImplementation(async () => ({
      ...groupScalars({ joinCode: writtenCode ?? JOIN_CODE }),
      members: [{ role: GroupRole.OWNER }],
      _count: { members: 2 },
    }));
    prismaMock.group.update
      .mockImplementationOnce(async () => {
        throw joinCodeCollision();
      })
      .mockImplementationOnce(
        async (args: { data: { joinCode: string } }) => {
          writtenCode = args.data.joinCode;
          return { id: GROUP_ID };
        },
      );

    const summary = await groupService.regenerateJoinCode(USER_ID, GROUP_ID);

    const codes = prismaMock.group.update.mock.calls.map(
      (call) => (call[0] as { data: { joinCode: string } }).data.joinCode,
    );
    expect(codes).toHaveLength(2);
    expect(codes[0]).not.toBe(codes[1]);
    expect(summary.joinCode).toBe(codes[1]);
  });

  it("gives up with 409 after exhausting code-generation attempts", async () => {
    mockManageableGroup(GroupRole.OWNER);
    prismaMock.group.update.mockImplementation(async () => {
      throw joinCodeCollision();
    });

    const error = await catchError(
      groupService.regenerateJoinCode(USER_ID, GROUP_ID),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(
      "Could not generate a unique join code, please try again",
    );
    expect(prismaMock.group.update).toHaveBeenCalledTimes(3);
  });
});

describe("createGroup (regression for the shared join-code retry helper)", () => {
  it("creates the group plus OWNER membership with a fresh valid code", async () => {
    const tx = {
      group: {
        create: vi.fn().mockResolvedValue(groupScalars()),
      },
      groupMember: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction.mockImplementation(
      async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );

    const summary = await groupService.createGroup(USER_ID, {
      name: "Weekend Trip",
      description: "Cabin",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.groupMember.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, groupId: GROUP_ID, role: GroupRole.OWNER },
    });
    const created = tx.group.create.mock.calls[0][0] as {
      data: { joinCode: string };
    };
    expect(created.data.joinCode).toMatch(JOIN_CODE_FORMAT);
    expect(summary).toMatchObject({
      role: GroupRole.OWNER,
      memberCount: 1,
    });
  });

  it("retries the whole transaction on a join-code collision", async () => {
    const tx = {
      group: {
        create: vi.fn().mockResolvedValue(groupScalars()),
      },
      groupMember: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prismaMock.$transaction
      .mockRejectedValueOnce(joinCodeCollision())
      .mockImplementationOnce(
        async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
      );

    const summary = await groupService.createGroup(USER_ID, {
      name: "Weekend Trip",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(summary.role).toBe(GroupRole.OWNER);
  });

  it("gives up with 409 when no unique code can be generated", async () => {
    prismaMock.$transaction.mockImplementation(async () => {
      throw joinCodeCollision();
    });

    const error = await catchError(
      groupService.createGroup(USER_ID, { name: "Weekend Trip" }),
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(
      "Could not generate a unique join code, please try again",
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });
});
