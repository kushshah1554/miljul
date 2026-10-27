import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as choreController from "./chore.controller";

export const choreRouter = Router();

// Mounted at /api/groups, so the full paths are /api/groups/:groupId/chores[...].
// The group-wide pause-all / resume-all paths are registered before the
// /:choreId routes so the literals are never read as a chore id.

choreRouter.post("/:groupId/chores/pause-all", requireAuth, choreController.pauseAll);
choreRouter.post("/:groupId/chores/resume-all", requireAuth, choreController.resumeAll);
choreRouter.get("/:groupId/chore-pauses", requireAuth, choreController.listPauses);

choreRouter.post("/:groupId/chores", requireAuth, choreController.create);
choreRouter.get("/:groupId/chores", requireAuth, choreController.list);
choreRouter.get("/:groupId/chores/:choreId", requireAuth, choreController.getOne);
choreRouter.patch("/:groupId/chores/:choreId", requireAuth, choreController.update);
choreRouter.patch("/:groupId/chores/:choreId/archive", requireAuth, choreController.archive);

choreRouter.post(
  "/:groupId/chores/:choreId/participants",
  requireAuth,
  choreController.addParticipant,
);
choreRouter.delete(
  "/:groupId/chores/:choreId/participants/:userId",
  requireAuth,
  choreController.removeParticipant,
);
choreRouter.patch(
  "/:groupId/chores/:choreId/participants/:userId/availability",
  requireAuth,
  choreController.setAvailability,
);

choreRouter.put(
  "/:groupId/chores/:choreId/queue/original",
  requireAuth,
  choreController.reorderOriginal,
);
choreRouter.post("/:groupId/chores/:choreId/queue/swap", requireAuth, choreController.swap);
choreRouter.post("/:groupId/chores/:choreId/queue/move", requireAuth, choreController.move);

choreRouter.put(
  "/:groupId/chores/:choreId/checklist",
  requireAuth,
  choreController.replaceChecklist,
);

choreRouter.post("/:groupId/chores/:choreId/pause", requireAuth, choreController.pause);
choreRouter.post("/:groupId/chores/:choreId/resume", requireAuth, choreController.resume);
