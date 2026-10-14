import bcrypt from "bcryptjs";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../utils/AppError";
import { requireFound } from "../../utils/helpers";
import type { LoginInput, SignupInput } from "./auth.validation";
import type { AuthUser, RefreshTokenPayload } from "./auth.types";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./token.service";

const SALT_ROUNDS = 10;

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
}): AuthUser {
  return { id: user.id, email: user.email, name: user.name };
}

async function issueTokens(user: AuthUser): Promise<AuthResult> {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: jti },
  });

  return { user, accessToken, refreshToken };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "Email is already registered");
  }

  const password = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name: input.name.trim(), email, password },
  });

  return issueTokens(toAuthUser(user));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  return issueTokens(toAuthUser(user));
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  const found = requireFound(user, "Session is no longer valid", 401);

  // Reject tokens that were already rotated or revoked.
  if (found.refreshToken !== payload.jti) {
    throw new AppError(401, "Session is no longer valid");
  }

  return issueTokens(toAuthUser(found));
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  let payload: RefreshTokenPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    // Invalid or expired token: nothing to revoke.
    return;
  }

  await prisma.user.updateMany({
    where: { id: payload.sub },
    data: { refreshToken: null },
  });
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  return requireFound(user, "User not found", 404);
}
