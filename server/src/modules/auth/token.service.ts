import { randomUUID } from "node:crypto";
import type { Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import type {
  AccessTokenPayload,
  AuthUser,
  RefreshTokenPayload,
} from "./auth.types";

export const REFRESH_COOKIE_NAME = "refreshToken";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, name: user.name }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (typeof decoded === "string" || !decoded.sub) {
      throw new AppError(401, "Invalid access token");
    }

    return {
      sub: decoded.sub,
      email: String(decoded.email ?? ""),
      name: String(decoded.name ?? ""),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid or expired access token");
  }
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = randomUUID();

  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    subject: userId,
    jwtid: jti,
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as SignOptions["expiresIn"],
  });

  return { token, jti };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (typeof decoded === "string" || !decoded.sub || !decoded.jti) {
      throw new AppError(401, "Invalid refresh token");
    }

    return { sub: decoded.sub, jti: decoded.jti };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid or expired refresh token");
  }
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
}
