import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import {
  createGroupSchema,
  groupIdParamSchema,
  updateGroupSchema,
} from "./group.validation";
import * as groupService from "./group.service";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const input = parseBody(createGroupSchema, req.body);

  const group = await groupService.createGroup(authUser.id, input);

  res.status(201).json(ok({ group }));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);

  const groups = await groupService.listGroups(authUser.id);

  res.json(ok({ groups }));
});

export const getDetails = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const group = await groupService.getGroupById(authUser.id, groupId);

  res.json(ok({ group }));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(updateGroupSchema, req.body);

  const group = await groupService.updateGroup(authUser.id, groupId, input);

  res.json(ok({ group }));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  await groupService.deleteGroup(authUser.id, groupId);

  res.status(204).send();
});
