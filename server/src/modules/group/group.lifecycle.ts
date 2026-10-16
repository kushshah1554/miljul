import { AppError } from "../../utils/AppError";
import { prisma } from "../../utils/prisma";
import { Prisma } from "../../generated/prisma/client";

/**
 * Any object that can run a `group` query: the shared Prisma client at the
 * top level, or an interactive-transaction client inside a transaction.
 */
export type GroupReader = Prisma.TransactionClient | typeof prisma;

/** Single canonical message so every endpoint explains archiving the same way. */
export const GROUP_ARCHIVED_MESSAGE =
  "Group is archived, restore it before making changes";

/**
 * Shared group-lifecycle guard. Call it from every service that MUTATES a
 * group or data attached to it: group details, membership roles, member
 * removal (except self-leave), ownership transfer, and any future expense
 * endpoints. Read-only endpoints (lists, details, history) must NOT call it.
 *
 * - 404 when the group does not exist.
 * - 409 when the group is archived: archived groups are read-only until an
 *   owner restores them.
 *
 * Pass the surrounding transaction client inside a transaction so the check
 * races safely against concurrent archive/restore operations: under
 * SERIALIZABLE isolation a concurrent archive conflicts with the mutation
 * and exactly one of the two is retried with fresh state.
 */
export async function assertGroupActive(
  db: GroupReader,
  groupId: string,
): Promise<void> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { isArchived: true },
  });

  if (!group) {
    throw new AppError(404, "Group not found");
  }

  if (group.isArchived) {
    throw new AppError(409, GROUP_ARCHIVED_MESSAGE);
  }
}
