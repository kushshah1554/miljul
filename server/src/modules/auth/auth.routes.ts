import { Router } from "express";
import { loginAccountLimiter, loginIpLimiter, signupLimiter } from "../../middleware/rateLimit";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/signup", signupLimiter, authController.signup);
authRouter.post("/login", loginIpLimiter, loginAccountLimiter, authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/google", authController.googleStart);
authRouter.get("/google/callback", authController.googleCallback);
