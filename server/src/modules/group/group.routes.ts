import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as groupController from "./group.controller";

export const groupRouter = Router();

groupRouter.post("/", requireAuth, groupController.create);
groupRouter.get("/", requireAuth, groupController.list);
groupRouter.get("/:groupId", requireAuth, groupController.getDetails);
groupRouter.patch("/:groupId", requireAuth, groupController.update);
groupRouter.delete("/:groupId", requireAuth, groupController.remove);
