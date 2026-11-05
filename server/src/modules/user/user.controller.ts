import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound } from "../../utils/helpers";
import { parseBody } from "../auth/auth.validation";
import * as userService from "./user.service";
import { updateProfileSchema } from "./user.validation";

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const { name } = parseBody(updateProfileSchema, req.body ?? {});

  if (name === undefined && !req.file) {
    throw new AppError(400, "Provide a name or an image");
  }

  const user = await userService.updateProfile(authUser.id, {
    name,
    image: req.file?.buffer,
  });

  res.json(ok({ user }));
});
