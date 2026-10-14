import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/signup", authController.signup);
authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", requireAuth, authController.me);
