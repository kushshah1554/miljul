import { z } from "zod";
import { cuidPattern, groupIdParamSchema } from "../group/group.validation";
import { paginationQueryShape } from "../../utils/pagination";

export const messageIdParamSchema = z.object({
  ...groupIdParamSchema.shape,
  messageId: z.string().trim().regex(cuidPattern, "Message id must be a valid id"),
});

export const createAnonymousMessageSchema = z.strictObject({
  content: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(1000, "Message must be at most 1000 characters"),
});

export const listAnonymousMessagesQuerySchema = z.object(paginationQueryShape);

export type CreateAnonymousMessageInput = z.infer<typeof createAnonymousMessageSchema>;
export type ListAnonymousMessagesQuery = z.infer<typeof listAnonymousMessagesQuerySchema>;
