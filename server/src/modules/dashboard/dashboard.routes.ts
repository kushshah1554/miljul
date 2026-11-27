import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, dashboardController.get);

// Mounted in app.ts at "/api/groups"
export const groupDashboardRouter = Router();

groupDashboardRouter.get("/:groupId/overview", requireAuth, dashboardController.groupOverview);
groupDashboardRouter.get("/:groupId/leaderboard", requireAuth, dashboardController.groupLeaderboard);
