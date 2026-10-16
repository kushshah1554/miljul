import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { Prisma, GroupRole } from "../../generated/prisma/client";
import type {
  ChangeRoleInput,
  TransferOwnershipInput,
} from "./group-member.validation";
import { assertGroupActive } from "../group/group.lifecycle";

// Safe, non-sensitive user fields exposed to fellow group members.
// Password hashes, refresh tokens and timestamps are never selected.
const memberUserSelect = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect;

// Membership columns returned without any user payload ("me" endpoint).
const membershipScalarsSelect = {
  id: true,
  userId: true,
  groupId: true,
  role: true,
  joinedAt: true,
} as const satisfies Prisma.GroupMemberSelect;

// Full membership record: safe membership scalars plus safe user info.
const membershipSelect = {
  ...membershipScalarsSelect,
  user: { select: memberUserSelect },
} as const satisfies Prisma.GroupMemberSelect;

type MemberUser = Prisma.UserGetPayload<{ select: typeof memberUserSelect }>;

export type MembershipScalars = Prisma.GroupMemberGetPayload<{
  select: typeof membershipScalarsSelect;
}>;

export type GroupMemberRecord = Prisma.GroupMemberGetPayload<{
  select: typeof membershipSelect;
}>;

export type { MemberUser };

const SERIALIZATION_RETRY_ATTEMPTS = 3;
const TRANSACTION_TIMEOUT_MS = 5_000;

function isSerializationFailure(error: unknown): boolean {
  // Standard Prisma shape: P2034 = write conflict or deadlock.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  // Driver-adapter shape used by this project (@prisma/adapter-pg):
  // a DriverAdapterError whose cause is a TransactionWriteConflict.
  // The adapter maps both SQLSTATE 40001 (serialization failure) and
  // 40P01 (deadlock) to kind "TransactionWriteConflict".
  if (!(error instanceof Error) || error.name !== "DriverAdapterError") {
    return false;
  }

  const cause: unknown = error.cause;
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  const { kind, originalCode } = cause as {
    kind?: unknown;
    originalCode?: unknown;
  };

  return (
    kind === "TransactionWriteConflict" ||
    originalCode === "40001" ||
    originalCode === "40P01"
  );
}

/**
 * Runs `work` inside a SERIALIZABLE transaction, retrying when PostgreSQL
 * aborts it with a serialization/write conflict (Prisma code P2034).
 *
 * SERIALIZABLE is what makes the last-owner invariant race-safe: two
 * concurrent transactions that each observe "two owners" and demote or
 * remove one would, under READ COMMITTED, leave the group with zero
 * owners. PostgreSQL's SSI detects that write-skew cycle and aborts one
 * transaction; this helper retries it, and the retry then observes a
 * single owner and fails with 409 instead of corrupting the group.
 */
async function runSerializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: TRANSACTION_TIMEOUT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      if (!isSerializationFailure(error)) {
        throw error;
      }
    }
  }

  throw new AppError(
    409,
    "The group was modified by another request at the same time, please retry",
  );
}

/**
 * Lists a group's members.
 *
 * A single relation query verifies that the group exists AND that the
 * caller belongs to it, so a non-member receives the same 404 as a
 * nonexistent group and group existence cannot be probed by id. Returns
 * an empty array when the group has no members.
 */
export async function listGroupMembers(
  authUserId: string,
  groupId: string,
): Promise<GroupMemberRecord[]> {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: authUserId } } },
    select: {
      members: {
        select: membershipSelect,
        // PostgreSQL orders enums by declaration order: OWNER, ADMIN, MEMBER.
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });

  return requireFound(group, "Group not found", 404).members;
}

/**
 * Returns the caller's own membership in a group. The identity comes only
 * from the verified auth context - no client-supplied userId is accepted.
 *
 * A missing record means either the group does not exist or the caller is
 * not a member; both answer 404 "Group not found" identically so private
 * group existence is never disclosed.
 */
export async function getMyMembership(
  authUserId: string,
  groupId: string,
): Promise<MembershipScalars> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: authUserId, groupId } },
    select: membershipScalarsSelect,
  });

  return requireFound(membership, "Group not found", 404);
}

/**
 * Changes one member's role.
 *
 * Authorization policy (enforced entirely server-side):
 * - OWNER and ADMIN may change roles; MEMBER always gets 403.
 * - OWNER may promote MEMBER -> ADMIN and demote ADMIN -> MEMBER, and may
 *   demote a fellow OWNER only while another owner remains.
 * - ADMIN may promote MEMBER -> ADMIN and demote ADMIN -> MEMBER, but can
 *   never assign OWNER and can never change the OWNER's role.
 * - OWNER is rejected up front: ownership can only move through a
 *   dedicated ownership-transfer operation, never a normal role update.
 * - The last OWNER can never be demoted (409), including self-demotion.
 *
 * Only the target GroupMember.role column is written - global user roles
 * and other memberships are untouched. The count + update pair runs in a
 * SERIALIZABLE transaction so concurrent demotions cannot strip a group
 * of its final owner.
 */
export async function changeMemberRole(
  authUserId: string,
  groupId: string,
  targetUserId: string,
  input: ChangeRoleInput,
): Promise<GroupMemberRecord> {
  if (input.role === GroupRole.OWNER) {
    throw new AppError(
      403,
      "Ownership cannot be changed here, transfer it through a dedicated ownership-transfer process",
    );
  }

  return runSerializable(async (tx) => {
    const caller = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: authUserId, groupId } },
      select: { role: true },
    });

    // Caller not in group (or group missing): same 404, no disclosure.
    if (!caller) {
      throw new AppError(404, "Group not found");
    }

    if (caller.role !== GroupRole.OWNER && caller.role !== GroupRole.ADMIN) {
      throw new AppError(403, "Only owners and admins can change member roles");
    }

    // Lifecycle guard: role changes are blocked while the group is archived
    // (409), regardless of the caller's role.
    await assertGroupActive(tx, groupId);

    const target = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      select: { id: true, role: true },
    });

    // Covers both "target user does not exist" and "not a member here".
    if (!target) {
      throw new AppError(404, "Member not found");
    }

    if (target.role === GroupRole.OWNER && caller.role !== GroupRole.OWNER) {
      throw new AppError(403, "An admin cannot change the owner's role");
    }

    if (target.role === GroupRole.OWNER) {
      const ownerCount = await tx.groupMember.count({
        where: { groupId, role: GroupRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new AppError(
          409,
          "The last owner's role cannot be changed, transfer ownership first",
        );
      }
    }

    return tx.groupMember.update({
      where: { id: target.id },
      data: { role: input.role },
      select: membershipSelect,
    });
  });
}

/**
 * Removes a membership row (removing someone or leaving the group)
 * without ever deleting the User account or any financial history.
 *
 * Nothing in the schema references GroupMember: Expense.paidById and
 * ExpenseSplit.userId point at users (ON DELETE RESTRICT) and
 * Expense.groupId at the group, so no expense, split, or settlement can
 * be cascaded away by this delete - historical and outstanding financial
 * records survive membership removal untouched. Only the one GroupMember
 * row identified by its primary key is deleted.
 *
 * Authorization policy:
 * - OWNER may remove anyone (ADMIN, MEMBER, or a fellow OWNER while
 *   another owner remains) and may leave unless they are the last owner.
 * - ADMIN may remove MEMBERs and may leave; cannot remove the OWNER and
 *   cannot remove another ADMIN.
 * - MEMBER cannot remove anyone else but may leave (self-removal).
 * - The last OWNER can never be removed or leave (409): ownership must be
 *   transferred first.
 *
 * The role check, last-owner count and delete run in one SERIALIZABLE
 * transaction, so two co-owners leaving simultaneously can never both
 * pass the last-owner check.
 */
export async function removeMember(
  authUserId: string,
  groupId: string,
  targetUserId: string,
): Promise<void> {
  await runSerializable(async (tx) => {
    const caller = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: authUserId, groupId } },
      select: { role: true },
    });

    if (!caller) {
      throw new AppError(404, "Group not found");
    }

    const target = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new AppError(404, "Member not found");
    }

    const isSelf = authUserId === targetUserId;

    if (caller.role === GroupRole.MEMBER) {
      if (!isSelf) {
        throw new AppError(403, "Only owners and admins can remove members");
      }
    } else if (caller.role === GroupRole.ADMIN) {
      if (target.role === GroupRole.OWNER) {
        throw new AppError(403, "The group owner cannot be removed");
      }
      if (!isSelf && target.role === GroupRole.ADMIN) {
        throw new AppError(403, "An admin cannot remove another admin");
      }
    }

    // Lifecycle guard: archived groups are frozen for every membership
    // mutation EXCEPT leaving on your own - self-removal stays allowed.
    // (The ownership-invariant guard below still applies to self-leaves.)
    if (!isSelf) {
      await assertGroupActive(tx, groupId);
    }

    if (target.role === GroupRole.OWNER) {
      const ownerCount = await tx.groupMember.count({
        where: { groupId, role: GroupRole.OWNER },
      });
      if (ownerCount <= 1) {
        throw new AppError(
          409,
          isSelf
            ? "You are the last owner: transfer ownership before leaving"
            : "The last owner cannot be removed",
        );
      }
    }

    await tx.groupMember.delete({ where: { id: target.id } });
  });
}

/**
 * Transfers ownership of a group to another member (immediate, one-step).
 *
 * Security rules, all enforced server-side inside one SERIALIZABLE
 * transaction:
 * - Only an authenticated OWNER may initiate a transfer; admins, members
 *   and non-members get 403/404.
 * - The caller's identity comes solely from the verified auth context;
 *   the body only ever names the *target*.
 * - The target must already be a member of this group (else 404), and
 *   transferring to yourself is rejected with 409.
 * - The new owner is promoted BEFORE the outgoing owner is demoted, so
 *   the group is never without an owner at any point in the transaction
 *   - including concurrent transfers or leave attempts, which SSI
 *   serializes against this transaction (retry on conflict).
 * - The outgoing owner steps down to MEMBER; no other membership, user
 *   account, or financial record is touched.
 *
 * Returns the new owner's membership record with safe user info.
 */
export async function transferOwnership(
  authUserId: string,
  groupId: string,
  input: TransferOwnershipInput,
): Promise<GroupMemberRecord> {
  return runSerializable(async (tx) => {
    const caller = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: authUserId, groupId } },
      select: { id: true, role: true },
    });

    if (!caller) {
      throw new AppError(404, "Group not found");
    }

    if (caller.role !== GroupRole.OWNER) {
      throw new AppError(403, "Only the group owner can transfer ownership");
    }

    // Lifecycle guard: ownership cannot move while the group is archived.
    await assertGroupActive(tx, groupId);

    if (input.newOwnerId === authUserId) {
      throw new AppError(409, "You are already the owner of this group");
    }

    const target = await tx.groupMember.findUnique({
      where: { userId_groupId: { userId: input.newOwnerId, groupId } },
      select: { id: true },
    });

    if (!target) {
      throw new AppError(404, "Member not found");
    }

    const newOwner = await tx.groupMember.update({
      where: { id: target.id },
      data: { role: GroupRole.OWNER },
      select: membershipSelect,
    });

    await tx.groupMember.update({
      where: { id: caller.id },
      data: { role: GroupRole.MEMBER },
    });

    return newOwner;
  });
}
