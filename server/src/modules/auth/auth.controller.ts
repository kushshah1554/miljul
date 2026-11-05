import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { AppError } from "../../utils/AppError";
import { loginSchema, parseBody, signupSchema } from "./auth.validation";
import * as authService from "./auth.service";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from "./token.service";

const OAUTH_STATE_COOKIE = "oauthState";
const oauthStateCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const, // Lax still sends it on the redirect back from Google
  path: "/auth/google",
};

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

export const googleStart = (_req: Request, res: Response) => {
  const state = randomBytes(32).toString("hex");

  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...oauthStateCookieOptions,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(authService.googleAuthUrl(state));
};

// The browser arrives here by redirect, so failures go back to the login page
// instead of showing the user a JSON error.
export const googleCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, oauthStateCookieOptions);

  try {
    // The state check stops an attacker logging a victim into the attacker's account
    if (!expectedState || state !== expectedState || typeof code !== "string") {
      throw new AppError(400, "Invalid Google login response");
    }

    const { refreshToken } = await authService.googleLogin(code);
    setRefreshCookie(res, refreshToken);
    res.redirect(new URL("/dashboard", env.CLIENT_URL).href);
  } catch (error) {
    console.error("Google login failed:", error);
    res.redirect(new URL("/login?error=google", env.CLIENT_URL).href);
  }
};
