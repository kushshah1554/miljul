import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as balanceController from "./balance.controller";

export const balanceRouter = Router();

// Mounted in app.ts at "/api/groups", so the final paths are:
//   GET /api/groups/:groupId/balances
//   GET /api/groups/:groupId/balances/me
//
// The /me path is a static segment registered BEFORE the dynamic
// /:groupId/balances route.  Because Express matches routes in registration
// order, "me" can never be misinterpreted as a groupId here.

balanceRouter.get(
  "/:groupId/balances/me",
  requireAuth,
  balanceController.me,
);

balanceRouter.get(
  "/:groupId/balances",
  requireAuth,
  balanceController.list,
);
