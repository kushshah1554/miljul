import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, dashboardController.get);
