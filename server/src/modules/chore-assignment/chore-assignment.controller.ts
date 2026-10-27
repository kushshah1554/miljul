import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { pageMeta } from "../../utils/pagination";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import { choreIdParamSchema } from "../chore/chore.validation";
import {
  assignmentIdParamSchema,
  listAssignmentsQuerySchema,
  myAssignmentsQuerySchema,
  reviewSchema,
  skipRequestSchema,
  skipSchema,
  submitSchema,
  waiveSchema,
} from "./chore-assignment.validation";
import * as assignmentService from "./chore-assignment.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const query = parseBody(listAssignmentsQuerySchema, req.query);

  const result = await assignmentService.listChoreAssignments(
    authUser.id,
    groupId,
    choreId,
    query,
  );

  res.json(
    ok({ assignments: result.assignments }, pageMeta(result.total, result.page, result.limit)),
  );
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(myAssignmentsQuerySchema, req.query);

  const result = await assignmentService.listMyAssignments(authUser.id, groupId, query);

  res.json(
    ok({ assignments: result.assignments }, pageMeta(result.total, result.page, result.limit)),
  );
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);

  res.json(
    ok(await assignmentService.getAssignment(authUser.id, groupId, choreId, assignmentId)),
  );
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);
  const input = parseBody(submitSchema, req.body ?? {});

  res.json(
    ok(
      await assignmentService.submitAssignment(authUser.id, groupId, choreId, assignmentId, input),
    ),
  );
});

export const review = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);
  const input = parseBody(reviewSchema, req.body);

  res.json(
    ok(
      await assignmentService.reviewAssignment(authUser.id, groupId, choreId, assignmentId, input),
    ),
  );
});

export const skipRequest = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);
  const input = parseBody(skipRequestSchema, req.body);

  res.json(
    ok(await assignmentService.requestSkip(authUser.id, groupId, choreId, assignmentId, input)),
  );
});

export const skip = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);
  const input = parseBody(skipSchema, req.body);

  res.json(
    ok(
      await assignmentService.skipAssignment(authUser.id, groupId, choreId, assignmentId, input),
    ),
  );
});

export const waive = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, assignmentId } = parseBody(assignmentIdParamSchema, req.params);
  const input = parseBody(waiveSchema, req.body);

  res.json(
    ok(
      await assignmentService.waiveAssignment(authUser.id, groupId, choreId, assignmentId, input),
    ),
  );
});
