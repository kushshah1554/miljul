import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as messageController from "./anonymous-message.controller";

export const anonymousMessageRouter = Router();

// Mounted at /api/groups:
//   POST   /api/groups/:groupId/anonymous-messages              any member
//   GET    /api/groups/:groupId/anonymous-messages              any member, paginated
//   DELETE /api/groups/:groupId/anonymous-messages/:messageId   owner only

anonymousMessageRouter.post("/:groupId/anonymous-messages", requireAuth, messageController.create);
anonymousMessageRouter.get("/:groupId/anonymous-messages", requireAuth, messageController.list);
anonymousMessageRouter.delete(
  "/:groupId/anonymous-messages/:messageId",
  requireAuth,
  messageController.remove,
);
