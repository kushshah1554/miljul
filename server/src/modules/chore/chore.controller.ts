import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { pageMeta } from "../../utils/pagination";
import { parseBody } from "../auth/auth.validation";
import { groupIdParamSchema } from "../group/group.validation";
import {
  addParticipantSchema,
  choreIdParamSchema,
  createChoreSchema,
  getChoreQuerySchema,
  listChoresQuerySchema,
  listPausesQuerySchema,
  moveSchema,
  optionalReasonBodySchema,
  participantParamSchema,
  removeParticipantQuerySchema,
  reorderQueueSchema,
  replaceChecklistSchema,
  setAvailabilitySchema,
  swapSchema,
  updateChoreSchema,
} from "./chore.validation";
import * as choreService from "./chore.service";

// ─── Chores ───────────────────────────────────────────────────────────────────

export const create = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(createChoreSchema, req.body);

  const chore = await choreService.createChore(authUser.id, groupId, input);

  res.status(201).json(ok({ chore }));
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listChoresQuerySchema, req.query);

  res.json(ok(await choreService.listChores(authUser.id, groupId, query)));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const { upcoming } = parseBody(getChoreQuerySchema, req.query);

  const chore = await choreService.getChore(authUser.id, groupId, choreId, upcoming);

  res.json(ok({ chore }));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(updateChoreSchema, req.body);

  const chore = await choreService.updateChore(authUser.id, groupId, choreId, input);

  res.json(ok({ chore }));
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(optionalReasonBodySchema, req.body ?? {});

  const chore = await choreService.archiveChore(authUser.id, groupId, choreId, input);

  res.json(ok({ chore }));
});

export const restore = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);

  const chore = await choreService.restoreChore(authUser.id, groupId, choreId);

  res.json(ok({ chore }));
});

// ─── Participants ─────────────────────────────────────────────────────────────

export const addParticipant = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(addParticipantSchema, req.body);

  const chore = await choreService.addParticipant(authUser.id, groupId, choreId, input);

  res.status(201).json(ok({ chore }));
});

export const removeParticipant = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, userId } = parseBody(participantParamSchema, req.params);
  const query = parseBody(removeParticipantQuerySchema, req.query);

  const chore = await choreService.removeParticipant(
    authUser.id,
    groupId,
    choreId,
    userId,
    query,
  );

  res.json(ok({ chore }));
});

export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId, userId } = parseBody(participantParamSchema, req.params);
  const input = parseBody(setAvailabilitySchema, req.body);

  res.json(
    ok(await choreService.setAvailability(authUser.id, groupId, choreId, userId, input)),
  );
});

// ─── Queues ───────────────────────────────────────────────────────────────────

export const reorderOriginal = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(reorderQueueSchema, req.body);

  const chore = await choreService.reorderOriginalQueue(authUser.id, groupId, choreId, input);

  res.json(ok({ chore }));
});

export const swap = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(swapSchema, req.body);

  res.json(ok(await choreService.swapInCycle(authUser.id, groupId, choreId, input)));
});

export const move = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(moveSchema, req.body);

  res.json(ok(await choreService.moveInCycle(authUser.id, groupId, choreId, input)));
});

// ─── Checklist ────────────────────────────────────────────────────────────────

export const replaceChecklist = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(replaceChecklistSchema, req.body);

  res.json(ok(await choreService.replaceChecklist(authUser.id, groupId, choreId, input)));
});

// ─── Pause / resume ───────────────────────────────────────────────────────────

export const pause = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(optionalReasonBodySchema, req.body ?? {});

  const chore = await choreService.pauseChore(authUser.id, groupId, choreId, input);

  res.json(ok({ chore }));
});

export const resume = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId, choreId } = parseBody(choreIdParamSchema, req.params);
  const input = parseBody(optionalReasonBodySchema, req.body ?? {});

  const chore = await choreService.resumeChore(authUser.id, groupId, choreId, input);

  res.json(ok({ chore }));
});

export const pauseAll = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(optionalReasonBodySchema, req.body ?? {});

  res.json(ok(await choreService.pauseAll(authUser.id, groupId, input)));
});

export const resumeAll = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const input = parseBody(optionalReasonBodySchema, req.body ?? {});

  res.json(ok(await choreService.resumeAll(authUser.id, groupId, input)));
});

export const listPauses = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { groupId } = parseBody(groupIdParamSchema, req.params);
  const query = parseBody(listPausesQuerySchema, req.query);

  const result = await choreService.listPauses(authUser.id, groupId, query);

  res.json(ok({ pauses: result.pauses }, pageMeta(result.total, result.page, result.limit)));
});
