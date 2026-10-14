import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import { loginSchema, parseBody, signupSchema } from "./auth.validation";
import * as authService from "./auth.service";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from "./token.service";

function getRefreshToken(req: Request): string | undefined {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof token === "string" && token ? token : undefined;
}

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(signupSchema, req.body);
  const { user, accessToken, refreshToken } = await authService.signup(input);

  setRefreshCookie(res, refreshToken);
  res.status(201).json(ok({ user, accessToken }));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(loginSchema, req.body);
  const { user, accessToken, refreshToken } = await authService.login(input);

  setRefreshCookie(res, refreshToken);
  res.json(ok({ user, accessToken }));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    throw new AppError(401, "Refresh token is missing");
  }

  const {
    user,
    accessToken,
    refreshToken: rotated,
  } = await authService.refresh(refreshToken);

  setRefreshCookie(res, rotated);
  res.json(ok({ user, accessToken }));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(getRefreshToken(req));

  clearRefreshCookie(res);
  res.json(ok({ message: "Logged out" }));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const authUser = requireFound(req.user, "Authentication required", 401);
  const user = await authService.getMe(authUser.id);

  res.json(ok({ user }));
});
