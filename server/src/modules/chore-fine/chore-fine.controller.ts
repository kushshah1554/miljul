import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { pageMeta } from "../../utils/pagination";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import { fineIdParamSchema, listFinesQuerySchema, voidFineSchema } from "./chore-fine.validation";
import * as fineService from "./chore-fine.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listFinesQuerySchema, req.query);

  const result = await fineService.listFines(authUser.id, groupId, query);

  res.json(ok({ fines: result.fines }, pageMeta(result.total, result.page, result.limit)));
});

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);

  res.json(ok(await fineService.getFineSummary(authUser.id, groupId)));
});

export const voidOne = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, fineId } = parseBody(fineIdParamSchema, req.params);
  const input = parseBody(voidFineSchema, req.body);

  res.json(ok(await fineService.voidFine(authUser.id, groupId, fineId, input)));
});
