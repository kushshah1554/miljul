import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { requireFound } from "../utils/helpers";
import { fail } from "../utils/envelope";

// shortcut: counters live in memory (one Render instance, reset on restart); use a Redis store when scaling out.
// Users reaching Render through Vercel may share an IP, so per-IP limits are
// loose and the strict ones are per account.

const MINUTE = 60_000;

const base = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: fail("Too many requests, please try again later", "RATE_LIMITED"),
} as const;

/** Every API and auth request, per IP. */
export const globalLimiter = rateLimit({ ...base, windowMs: MINUTE, limit: 600 });

/** New accounts, per IP. */
export const signupLimiter = rateLimit({ ...base, windowMs: 60 * MINUTE, limit: 50 });

/** Failed logins per IP, against trying many accounts. */
export const loginIpLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 100,
  skipSuccessfulRequests: true,
});

/** Failed logins per account; a changing or spoofed IP does not get around it. */
export const loginAccountLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const email: unknown = req.body?.email;
    return typeof email === "string"
      ? `email:${email.trim().toLowerCase().slice(0, 254)}`
      : ipKeyGenerator(req.ip ?? "");
  },
});

/** Profile updates (image uploads) per user; use after requireAuth. */
export const profileLimiter = rateLimit({
  ...base,
  windowMs: 60 * MINUTE,
  limit: 30,
  keyGenerator: (req: Request) => requireFound(req.user, "Authentication required", 401).id,
});
