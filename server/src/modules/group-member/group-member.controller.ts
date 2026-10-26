import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import {
  memberParamsSchema,
  transferOwnershipSchema,
} from "./group-member.validation";
import * as groupMemberService from "./group-member.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const members = await groupMemberService.listGroupMembers(
    authUser.id,
    groupId,
  );

  res.json(ok({ members }));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  // Identity comes only from the verified token, never from the request.
  const membership = await groupMemberService.getMyMembership(
    authUser.id,
    groupId,
  );

  res.json(ok({ membership }));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, userId } = parseBody(memberParamsSchema, req.params);

  await groupMemberService.removeMember(authUser.id, groupId, userId);

  res.status(204).send();
});

export const transferOwnership = asyncHandler(
  async (req: Request, res: Response) => {
    const authUser = requireFound(req.user, "Authentication required", 401);
    const { groupId } = parseBody(groupIdParamSchema, req.params);
    const input = parseBody(transferOwnershipSchema, req.body);

    const membership = await groupMemberService.transferOwnership(
      authUser.id,
      groupId,
      input,
    );

    res.json(ok({ membership }));
  },
);
