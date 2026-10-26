import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as groupMemberController from "./group-member.controller";

export const groupMemberRouter = Router();

// Mounted in app.ts at "/api/groups", so the final paths are
// /api/groups/:groupId/members[...]. Every endpoint requires
// authentication; params and bodies are validated with Zod inside the
// controllers, matching the group module's convention.
//
// "/members/me" is registered before any "/members/:userId" route so
// "me" can never be interpreted as a user id.
groupMemberRouter.get(
  "/:groupId/members",
  requireAuth,
  groupMemberController.list,
);
groupMemberRouter.get(
  "/:groupId/members/me",
  requireAuth,
  groupMemberController.me,
);
groupMemberRouter.delete(
  "/:groupId/members/:userId",
  requireAuth,
  groupMemberController.remove,
);

// Dedicated, one-step ownership transfer. Only an OWNER may call it; the
// target is named in the body (newOwnerId), so no client-supplied value
// ever establishes who the caller is. Registered after the /members
// routes above; no path overlaps with them.
groupMemberRouter.post(
  "/:groupId/ownership-transfer",
  requireAuth,
  groupMemberController.transferOwnership,
);
