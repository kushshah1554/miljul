import { randomInt } from "node:crypto";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { Prisma, GroupRole } from "../../generated/prisma/client";
import type {
  CreateGroupInput,
  ListGroupsQuery,
  UpdateGroupInput,
} from "./group.validation";
import { GROUP_ARCHIVED_MESSAGE } from "./group.lifecycle";

// Only safe, non-sensitive group fields are ever selected.
const groupSelect = {
  id: true,
  name: true,
  description: true,
  joinCode: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  isArchived: true,
  archivedAt: true,
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

/**
 * Fetches the summary (scalars + caller's role + member count) of a group
 * the caller belongs to. Returns 404 for unknown ids and groups the user
 * is not a member of, so membership cannot be probed by id. Archived
 * groups remain readable to their members.
 */
async function getSummary(
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
 * Lists the groups the user is a member of, filtered by lifecycle state.
 * The filter defaults to active groups only (see listGroupsQuerySchema),
 * so archived groups are never returned implicitly; "?status=archived"
 * and "?status=all" make them reachable. Empty array when none match.
 */
export async function listGroups(
  userId: string,
  filter: ListGroupsQuery,
): Promise<GroupSummary[]> {
  const statusFilter: Prisma.GroupWhereInput =
    filter.status === "active"
      ? { isArchived: false }
      : filter.status === "archived"
        ? { isArchived: true }
        : {};

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } }, ...statusFilter },
    select: metaSelect(userId),
    orderBy: { createdAt: "desc" },
  });

  return groups.map(toSummary);
}

/** Returns one group; archived groups remain readable to their members. */
export async function getGroupById(
  userId: string,
  groupId: string,
): Promise<GroupSummary> {
  return getSummary(userId, groupId);
}

/**
 * Partially updates a group. Only OWNER and ADMIN may update; non-members
 * receive 404 (existence is not disclosed), members with insufficient role
 * receive 403, and updates to an archived group receive 409 (archived
 * groups are read-only). Protected fields (id, createdById, joinCode,
 * timestamps, membership, lifecycle fields) can never be set from input.
 */
export async function updateGroup(
  userId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GroupSummary> {
  // One query yields existence, membership role and lifecycle state.
  const existing = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: {
      isArchived: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  });

  if (!existing) {
    throw new AppError(404, "Group not found");
  }

  const role = existing.members[0]?.role;
  if (role !== GroupRole.OWNER && role !== GroupRole.ADMIN) {
    throw new AppError(403, "Only owners and admins can update this group");
  }

  // Archived groups are read-only for normal management edits. Permission
  // is checked before lifecycle state everywhere: 404 -> 403 -> 409.
  if (existing.isArchived) {
    throw new AppError(409, GROUP_ARCHIVED_MESSAGE);
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
 * Archives a group: a lifecycle transition, never a delete. Only the OWNER
 * may archive (non-members get 404, other members 403). The state flip is
 * a conditional updateMany, so a concurrent duplicate archive can never
 * both report success - exactly one wins and the other gets 409.
 *
 * Only isArchived/archivedAt on the group row change: memberships,
 * expenses, expense splits and every other historical record are
 * deliberately untouched.
 */
export async function archiveGroup(
  userId: string,
  groupId: string,
): Promise<GroupSummary> {
  const existing = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: { members: { where: { userId }, select: { role: true }, take: 1 } },
  });

  if (!existing) {
    throw new AppError(404, "Group not found");
  }

  if (existing.members[0]?.role !== GroupRole.OWNER) {
    throw new AppError(403, "Only the group owner can archive the group");
  }

  const archived = await prisma.group.updateMany({
    where: { id: groupId, isArchived: false },
    data: { isArchived: true, archivedAt: new Date() },
  });

  if (archived.count === 0) {
    throw new AppError(409, "Group is already archived");
  }

  return getSummary(userId, groupId);
}

/**
 * Restores an archived group to active. Only the OWNER may restore
 * (symmetric with archiving); archivedAt is cleared. Uses the same
 * conditional-write protection as archiving against duplicate restores.
 */
export async function restoreGroup(
  userId: string,
  groupId: string,
): Promise<GroupSummary> {
  const existing = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    select: { members: { where: { userId }, select: { role: true }, take: 1 } },
  });

  if (!existing) {
    throw new AppError(404, "Group not found");
  }

  if (existing.members[0]?.role !== GroupRole.OWNER) {
    throw new AppError(403, "Only the group owner can restore the group");
  }

  const restored = await prisma.group.updateMany({
    where: { id: groupId, isArchived: true },
    data: { isArchived: false, archivedAt: null },
  });

  if (restored.count === 0) {
    throw new AppError(409, "Group is not archived");
  }

  return getSummary(userId, groupId);
}
