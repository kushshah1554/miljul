import { Prisma, GroupRole } from "../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { runSerializable } from "../../utils/transaction";
import { GROUP_ARCHIVED_MESSAGE } from "../group/group.lifecycle";
import { catchUpGroup } from "./chore.engine";

export type ChoreContext = {
  tx: Prisma.TransactionClient;
  userId: string;
  groupId: string;
  role: GroupRole;
  timezone: string;
  choresPausedAt: Date | null;
  now: Date;
};

/**
 * Shared entry point of every chore service call. Inside one SERIALIZABLE
 * transaction it checks access (404 non-member → 403 not owner → 409
 * archived group, the codebase's usual order), brings the group's chores
 * up to date, then runs `work`.
 *
 * - `owner`: owner-only action, named in the 403 message; implies `write`.
 * - `write`: a mutation, refused while the group is archived.
 */
export function withChores<T>(
  userId: string,
  groupId: string,
  opts: { owner?: string; write?: boolean },
  work: (ctx: ChoreContext) => Promise<T>,
): Promise<T> {
  return runSerializable(async (tx) => {
    const membership = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: {
        role: true,
        group: { select: { isArchived: true, timezone: true, choresPausedAt: true } },
      },
    });
    if (!membership) {
      throw new AppError(404, "Group not found");
    }
    if (opts.owner && membership.role !== GroupRole.OWNER) {
      throw new AppError(403, `Only the group owner can ${opts.owner}`);
    }
    const { isArchived, timezone, choresPausedAt } = membership.group;
    if ((opts.write || opts.owner) && isArchived) {
      throw new AppError(409, GROUP_ARCHIVED_MESSAGE);
    }

    const now = new Date();
    // Archived groups are read-only, so they are never caught up.
    if (!isArchived) {
      await catchUpGroup(tx, groupId, timezone, now);
    }

    return work({ tx, userId, groupId, role: membership.role, timezone, choresPausedAt, now });
  });
}
