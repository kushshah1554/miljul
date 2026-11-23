import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import * as dashboardService from "./dashboard.service";
import { dashboardQuerySchema } from "./dashboard.validation";

/** GET /api/dashboard — the authenticated user's own totals across all groups. */
export const get = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const query = parseBody(dashboardQuerySchema, req.query);

  res.json(ok(await dashboardService.getDashboard(authUser.id, query)));
});
