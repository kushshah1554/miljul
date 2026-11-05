import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { uploadImage } from "../../middleware/uploadImage";
import * as userController from "./user.controller";

export const userRouter = Router();

// requireAuth comes first so anonymous requests never get to upload a file
userRouter.patch("/me", requireAuth, uploadImage, userController.updateMe);
