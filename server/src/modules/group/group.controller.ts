import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import {
  createGroupSchema,
  groupIdParamSchema,
  joinGroupSchema,
  listGroupsQuerySchema,
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
  const query = parseBody(listGroupsQuerySchema, req.query);

  const groups = await groupService.listGroups(authUser.id, query);

  res.json(ok({ groups }));
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const input = parseBody(joinGroupSchema, req.body);

  const group = await groupService.joinGroupByCode(authUser.id, input);

  res.status(201).json(ok({ group }));
});

export const regenerateJoinCode = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = requireFound(req.user, "Authentication required", 401);
    const { groupId } = parseBody(groupIdParamSchema, req.params);

    const group = await groupService.regenerateJoinCode(authUser.id, groupId);

    // The new code is echoed at the top level for convenience; the
    // authorization check happened in the service, so only OWNER
    // callers ever see it.
    res.json(ok({ joinCode: group.joinCode, group }));
  },
);

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

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const group = await groupService.archiveGroup(authUser.id, groupId);

  res.json(ok({ group }));
});

export const restore = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const group = await groupService.restoreGroup(authUser.id, groupId);

  res.json(ok({ group }));
});
