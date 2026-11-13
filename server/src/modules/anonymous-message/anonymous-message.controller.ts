import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { pageMeta } from "../../utils/pagination";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import {
  createAnonymousMessageSchema,
  listAnonymousMessagesQuerySchema,
  messageIdParamSchema,
} from "./anonymous-message.validation";
import * as messageService from "./anonymous-message.service";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(createAnonymousMessageSchema, req.body);

  const message = await messageService.createMessage(authUser.id, groupId, input);

  res.status(201).json(ok({ message }));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listAnonymousMessagesQuerySchema, req.query);

  const result = await messageService.listMessages(authUser.id, groupId, query);

  res.json(
    ok({ messages: result.messages }, pageMeta(result.total, result.page, result.limit)),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, messageId } = parseBody(messageIdParamSchema, req.params);

  await messageService.deleteMessage(authUser.id, groupId, messageId);

  res.status(204).send();
});
