import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as fineController from "./chore-fine.controller";

export const choreFineRouter = Router();

// Mounted at /api/groups → /api/groups/:groupId/chore-fines[...].
// "/summary" is a GET and "/:fineId/void" a POST, so they cannot collide.
choreFineRouter.get("/:groupId/chore-fines", requireAuth, fineController.list);
choreFineRouter.get("/:groupId/chore-fines/summary", requireAuth, fineController.summary);
choreFineRouter.post("/:groupId/chore-fines/:fineId/void", requireAuth, fineController.voidOne);
