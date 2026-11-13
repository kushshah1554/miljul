import { GroupRole, Prisma } from "../../generated/prisma/client";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { assertGroupActive } from "../group/group.lifecycle";
import type {
  CreateAnonymousMessageInput,
  ListAnonymousMessagesQuery,
} from "./anonymous-message.validation";

// The author is never stored or returned: membership is checked, then forgotten.
const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
} as const satisfies Prisma.AnonymousMessageSelect;

export type AnonymousMessageItem = Prisma.AnonymousMessageGetPayload<{
  select: typeof messageSelect;
}>;

/** 404 for non-members and unknown groups alike, so existence is not disclosed. */
async function requireMember(userId: string, groupId: string): Promise<GroupRole> {
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { role: true },
  });
  if (!membership) throw new AppError(404, "Group not found");
  return membership.role;
}

export async function createMessage(
  authUserId: string,
  groupId: string,
  input: CreateAnonymousMessageInput,
): Promise<AnonymousMessageItem> {
  await requireMember(authUserId, groupId);
  await assertGroupActive(prisma, groupId);

  return prisma.anonymousMessage.create({
    data: { groupId, content: input.content },
    select: messageSelect,
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

  return { messages, total, page, limit };
}

/** Owner-only moderation: with no author on record, only the owner can remove a message. */
export async function deleteMessage(
  authUserId: string,
  groupId: string,
  messageId: string,
): Promise<void> {
  const role = await requireMember(authUserId, groupId);
  if (role !== GroupRole.OWNER) {
    throw new AppError(403, "Only the group owner can delete messages");
  }
  await assertGroupActive(prisma, groupId);

  const { count } = await prisma.anonymousMessage.deleteMany({
    where: { id: messageId, groupId },
  });
  if (count === 0) throw new AppError(404, "Message not found");
}
