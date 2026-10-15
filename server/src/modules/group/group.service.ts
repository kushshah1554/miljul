import { randomInt } from "node:crypto";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { Prisma, GroupRole } from "../../generated/prisma/client";
import type { CreateGroupInput, UpdateGroupInput } from "./group.validation";

// Only safe, non-sensitive group fields are ever selected.
const groupSelect = {
  id: true,
  name: true,
  description: true,
  joinCode: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.GroupSelect;

type GroupScalars = Prisma.GroupGetPayload<{ select: typeof groupSelect }>;

export type GroupSummary = GroupScalars & {
  role: GroupRole;
  memberCount: number;
};

// Exclude visually ambiguous characters (0/O, 1/I/L).
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 8;
const JOIN_CODE_MAX_ATTEMPTS = 3;

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

type GroupWithMeta = GroupScalars & {
  members: Array<{ role: GroupRole }>;
  _count: { members: number };
};

// Builds the shared list/detail query: group scalars, the current user's
// role, and the member count in a single relation query.
function metaSelect(userId: string) {
  return {
    ...groupSelect,
    members: {
      where: { userId },
      select: { role: true },
      take: 1,
    },
    _count: { select: { members: true } },
  } as const satisfies Prisma.GroupSelect;
}

function toSummary(group: GroupWithMeta): GroupSummary {
  const { members, _count, ...scalars } = group;
  return {
    ...scalars,
    role: members[0]?.role ?? GroupRole.MEMBER,
    memberCount: _count.members,
  };
}

/**
 * Creates a group and the creator's OWNER membership in one transaction.
 * A join code is generated with retries so a rare unique-constraint
 * collision never aborts the request with a raw Prisma error.
 */
export async function createGroup(
  createdById: string,
  input: CreateGroupInput,
): Promise<GroupSummary> {
  for (let attempt = 1; attempt <= JOIN_CODE_MAX_ATTEMPTS; attempt += 1) {
    const joinCode = generateJoinCode();

    try {
      return await prisma.$transaction(async (tx) => {
        const group = await tx.group.create({
          data: {
            name: input.name,
            description: input.description ?? null,
            joinCode,
            createdById,
          },
          select: groupSelect,
        });

        await tx.groupMember.create({
          data: { userId: createdById, groupId: group.id, role: GroupRole.OWNER },
        });

        return { ...group, role: GroupRole.OWNER, memberCount: 1 };
      });
    } catch (error) {
      // Unique violation on joinCode: try a new code; anything else aborts.
      if (isUniqueConstraintError(error) && attempt < JOIN_CODE_MAX_ATTEMPTS) {
        continue;
      }
      if (isUniqueConstraintError(error)) {
        throw new AppError(409, "Could not generate a unique join code, please try again");
      }
      throw error;
    }
  }

  throw new AppError(409, "Could not generate a unique join code, please try again");
}

/** Lists every group the user is a member of. Empty array when none. */
export async function listGroups(userId: string): Promise<GroupSummary[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    select: metaSelect(userId),
    orderBy: { createdAt: "desc" },
  });

  return groups.map(toSummary);
}

/**
 * Returns one group. Returns 404 for both unknown ids and groups the user
 * is not a member of, so membership cannot be probed by id.
 */
export async function getGroupById(
  userId: string,
  groupId: string,
): Promise<GroupSummary> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: metaSelect(userId),
  });

  return toSummary(requireFound(group, "Group not found", 404));
}

/**
 * Partially updates a group. Only OWNER and ADMIN may update; non-members
 * receive 404 (existence is not disclosed), members with insufficient role
 * receive 403. Protected fields (id, createdById, joinCode, timestamps,
 * membership) can never be set from input.
 */
export async function updateGroup(
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupSummary> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });

  if (!membership) {
    throw new AppError(404, "Group not found");
  }

  if (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN) {
    throw new AppError(403, "Only owners and admins can update this group");
  }

  const data: Prisma.GroupUpdateInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data,
    select: metaSelect(userId),
  });

  return toSummary(group);
}

/**
 * Deletes a group. Only the OWNER may delete; everyone else gets 404/403.
 *
 * The schema cascades group deletion to memberships, expenses and expense
 * splits (see migration: ON DELETE CASCADE on those foreign keys), so a
 * single delete is atomic and cannot leave orphaned rows. The
 * Group.createdBy -> User relation is RESTRICT, which only prevents deleting
 * the *user*; it does not block deleting the group and never deletes
 * unrelated users.
 */
export async function deleteGroup(userId: string, groupId: string): Promise<void> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });

  if (!membership) {
    throw new AppError(404, "Group not found");
  }

  if (membership.role !== GroupRole.OWNER) {
    throw new AppError(403, "Only the group owner can delete this group");
  }

  await prisma.group.delete({ where: { id: groupId } });
}
