import { apiDelete, apiGetWithMeta, apiPost } from "@/lib/api";
import type { PaginationMeta } from "@/lib/types";

/** No author fields by design: messages are anonymous. */
export interface AnonymousMessage {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean; // true only for messages the caller posted
}

interface MessagesPayload {
  messages: AnonymousMessage[];
}

interface MessagePayload {
  message: AnonymousMessage;
}

export interface ListMessagesQuery {
  page?: number;
  limit?: number;
}

const messagesUrl = (groupId: string) => `/api/groups/${groupId}/anonymous-messages`;

/** POST /api/groups/:groupId/anonymous-messages — any member */
export function createMessage(groupId: string, content: string) {
  return apiPost<MessagePayload, { content: string }>(messagesUrl(groupId), { content });
}

/** GET /api/groups/:groupId/anonymous-messages — paginated, newest first */
export function listMessages(groupId: string, query: ListMessagesQuery = {}) {
  return apiGetWithMeta<MessagesPayload, PaginationMeta>(messagesUrl(groupId), {
    params: query,
  });
}

/** DELETE /api/groups/:groupId/anonymous-messages/:messageId — OWNER (any message) or the author */
export function deleteMessage(groupId: string, messageId: string) {
  return apiDelete(`${messagesUrl(groupId)}/${messageId}`);
}
