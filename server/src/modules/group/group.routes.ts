import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as groupController from "./group.controller";

export const groupRouter = Router();

groupRouter.post("/", requireAuth, groupController.create);
groupRouter.get("/", requireAuth, groupController.list);

// Lifecycle transitions. The specific paths are registered before the
// generic "/:groupId" routes for clarity (they cannot actually collide:
// "/:groupId" matches a single segment only).
groupRouter.patch("/:groupId/archive", requireAuth, groupController.archive);
groupRouter.patch("/:groupId/restore", requireAuth, groupController.restore);

groupRouter.get("/:groupId", requireAuth, groupController.getDetails);
groupRouter.patch("/:groupId", requireAuth, groupController.update);

// NOTE: DELETE /:groupId was intentionally REMOVED. Groups are archived
// instead of deleted (PATCH /:groupId/archive), so no routine API call can
// cascade-delete memberships, expenses or expense-split history. There is
// currently no permanent-deletion endpoint by design.
