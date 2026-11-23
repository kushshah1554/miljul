import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import * as dashboardService from "./dashboard.service";
import { dashboardQuerySchema, leaderboardQuerySchema, overviewQuerySchema } from "./dashboard.validation";

/** GET /api/dashboard — the authenticated user's own totals across all groups. */
export const get = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const query = parseBody(dashboardQuerySchema, req.query);

  res.json(ok(await dashboardService.getDashboard(authUser.id, query)));
});

/** GET /api/groups/:groupId/overview — my totals and the whole group's. */
export const groupOverview = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(overviewQuerySchema, req.query);

  res.json(ok(await dashboardService.getGroupOverview(authUser.id, groupId, query)));
});

/** GET /api/groups/:groupId/leaderboard — per-member totals of a year or month. */
export const groupLeaderboard = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(leaderboardQuerySchema, req.query);

  res.json(ok(await dashboardService.getGroupLeaderboard(authUser.id, groupId, query)));
});
