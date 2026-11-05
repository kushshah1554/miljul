import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../../config/env";
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
  profileUrl: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profileUrl: user.profileUrl,
  };
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
  // Google-only accounts have no password
  if (!user?.password) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  return issueTokens(toAuthUser(user));
}

const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.url().optional(),
});

export function googleAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
  }).toString();
  return url.href;
}

async function fetchGoogleProfile(code: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new AppError(502, `Google token exchange failed: ${tokenRes.status}`);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!profileRes.ok) {
    throw new AppError(502, `Google profile fetch failed: ${profileRes.status}`);
  }
  return googleProfileSchema.parse(await profileRes.json());
}

export async function googleLogin(code: string): Promise<AuthResult> {
  const profile = await fetchGoogleProfile(code);

  // We link accounts by email, so Google must have confirmed the address
  if (!profile.email_verified) {
    throw new AppError(403, "Google email is not verified");
  }

  const email = profile.email.toLowerCase();
  const existing =
    (await prisma.user.findUnique({ where: { googleId: profile.sub } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (existing?.googleId && existing.googleId !== profile.sub) {
    throw new AppError(409, "Email is linked to a different Google account");
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        // Only fills a missing picture, so it never replaces an uploaded one
        data: {
          googleId: profile.sub,
          profileUrl: existing.profileUrl ?? profile.picture,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: profile.name ?? email.split("@")[0]!,
          googleId: profile.sub,
          profileUrl: profile.picture,
        },
      });

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
