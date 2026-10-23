import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import * as balanceService from "./balance.service";

/**
 * GET /api/groups/:groupId/balances
 *
 * Returns the net balance of every current group member plus a derived
 * settlement suggestion list.
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const result = await balanceService.getGroupBalances(authUser.id, groupId);

  res.json(ok(result));
});

/**
 * GET /api/groups/:groupId/balances/me
 *
 * Returns only the authenticated user's balance in the group.
 * The user's identity comes entirely from the verified auth token —
 * no client-supplied userId is accepted.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  const result = await balanceService.getMyGroupBalance(authUser.id, groupId);

  res.json(ok(result));
});
