import { createHmac, timingSafeEqual } from "node:crypto";
import { GroupRole, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { env } from "../../config/env";
import { assertGroupActive } from "../group/group.lifecycle";
import { runSerializable } from "../../utils/transaction";
import { localDateString } from "../../utils/timezone";
import type {
  CreateAnonymousMessageInput,
  ListAnonymousMessagesQuery,
} from "./anonymous-message.validation";

// The author is never stored or returned. Only a keyed hash is kept, and the
// client just learns `isMine` for its own messages.
const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  authorHash: true,
} as const satisfies Prisma.AnonymousMessageSelect;

export type AnonymousMessageItem = {
  id: string;
  content: string;
  createdAt: Date;
  isMine: boolean;
};

export function hashAuthor(userId: string, messageId: string): string {
  return createHmac("sha256", env.ANON_MESSAGE_SECRET)
    .update(`${userId}:${messageId}`)
    .digest("hex");
}

function isAuthor(userId: string, message: { id: string; authorHash: string | null }) {
  if (!message.authorHash) return false; // posted before author hashes existed
  const expected = Buffer.from(hashAuthor(userId, message.id));
  const actual = Buffer.from(message.authorHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function toItem(
  userId: string,
  message: Prisma.AnonymousMessageGetPayload<{ select: typeof messageSelect }>,
): AnonymousMessageItem {
  const { authorHash: _hash, ...rest } = message;
  return { ...rest, isMine: isAuthor(userId, message) };
}

/** 404 for non-members and unknown groups alike, so existence is not disclosed. */
async function requireMember(userId: string, groupId: string): Promise<GroupRole> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });
  if (!membership) throw new AppError(404, "Group not found");
  return membership.role;
}

export const DAILY_MESSAGE_LIMIT = 3;

/**
 * Counts the post against the member's daily quota (group-local day) and
 * creates the message in one transaction, so a rejected post never counts.
 */
export async function createMessage(
  authUserId: string,
  groupId: string,
  input: CreateAnonymousMessageInput,
): Promise<AnonymousMessageItem> {
  await requireMember(authUserId, groupId);

  return runSerializable(async (tx) => {
    await assertGroupActive(tx, groupId);
    const { timezone } = await tx.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { timezone: true },
    });
    const day = localDateString(new Date(), timezone);
    const key = { userId: authUserId, groupId };

    // Keep no posting history beyond today.
    await tx.anonymousMessageQuota.deleteMany({ where: { ...key, day: { not: day } } });
    const { count } = await tx.anonymousMessageQuota.upsert({
      where: { userId_groupId_day: { ...key, day } },
      create: { ...key, day, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    if (count > DAILY_MESSAGE_LIMIT) {
      throw new AppError(
        429,
        `You can post at most ${DAILY_MESSAGE_LIMIT} anonymous messages per day`,
      );
    }

    // The hash needs the message id, so it is set right after insert.
    const { id } = await tx.anonymousMessage.create({
      data: { groupId, content: input.content },
      select: { id: true },
    });
    const message = await tx.anonymousMessage.update({
      where: { id },
      data: { authorHash: hashAuthor(authUserId, id) },
      select: messageSelect,
    });
    return toItem(authUserId, message);
  });
}

export async function listMessages(
  authUserId: string,
  groupId: string,
  { page, limit }: ListAnonymousMessagesQuery,
) {
  await requireMember(authUserId, groupId);

  const where = { groupId };
  const [messages, total] = await Promise.all([
    prisma.anonymousMessage.findMany({
      where,
      select: messageSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.anonymousMessage.count({ where }),
  ]);

  return { messages: messages.map((m) => toItem(authUserId, m)), total, page, limit };
}

/** The owner can delete any message; a member only the ones they posted. */
export async function deleteMessage(
  authUserId: string,
  groupId: string,
  messageId: string,
): Promise<void> {
  const role = await requireMember(authUserId, groupId);
  await assertGroupActive(prisma, groupId);

  const message = requireFound(
    await prisma.anonymousMessage.findFirst({
      where: { id: messageId, groupId },
      select: { id: true, authorHash: true },
    }),
    "Message not found",
  );
  if (role !== GroupRole.OWNER && !isAuthor(authUserId, message)) {
    throw new AppError(403, "You can only delete your own messages");
  }

  await prisma.anonymousMessage.deleteMany({ where: { id: messageId, groupId } });
}
