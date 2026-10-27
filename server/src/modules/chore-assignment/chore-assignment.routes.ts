import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as assignmentController from "./chore-assignment.controller";

export const choreAssignmentRouter = Router();

// Mounted at /api/groups. Base for per-chore routes:
//   /api/groups/:groupId/chores/:choreId/assignments
const base = "/:groupId/chores/:choreId/assignments";

choreAssignmentRouter.get(
  "/:groupId/chore-assignments/mine",
  requireAuth,
  assignmentController.mine,
);

choreAssignmentRouter.get(base, requireAuth, assignmentController.list);
choreAssignmentRouter.get(`${base}/:assignmentId`, requireAuth, assignmentController.getOne);
choreAssignmentRouter.post(`${base}/:assignmentId/submit`, requireAuth, assignmentController.submit);
choreAssignmentRouter.post(`${base}/:assignmentId/review`, requireAuth, assignmentController.review);
choreAssignmentRouter.post(
  `${base}/:assignmentId/skip-request`,
  requireAuth,
  assignmentController.skipRequest,
);
choreAssignmentRouter.post(`${base}/:assignmentId/skip`, requireAuth, assignmentController.skip);
choreAssignmentRouter.post(`${base}/:assignmentId/waive`, requireAuth, assignmentController.waive);
