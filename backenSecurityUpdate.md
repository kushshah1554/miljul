# Backend security update

What was added and changed, with the code. In diff blocks, `+` lines were added and `-` lines were removed.

## Summary

| Protection | What it does |
|---|---|
| Helmet | Adds security headers and hides that the server uses Express |
| Login limit | 10 failed logins per account in 15 minutes; also 100 per IP |
| Signup limit | 50 per IP per hour |
| Profile update limit | 30 per user per hour |
| General limit | 600 requests per IP per minute (`/health` is exempt) |
| No caching | Responses are sent with `Cache-Control: no-store` |
| Stronger secrets | JWT secrets must be at least 32 characters and different |
| JWT algorithm | Only `HS256` tokens are accepted |
| Login timing | Unknown emails get the same password check as real ones |
| Large requests | JSON over 100 KB gets a 413 error instead of a 500 |
| Package fixes | `npm audit fix`: `multer`, `qs`, `body-parser`, `fast-uri` |

## Code

### 1. `server/package.json`

New packages: `helmet` (headers) and `express-rate-limit` (limits). `package-lock.json` also changed, including the package security fixes.

```diff
@@ -24,4 +24,6 @@
     "dotenv": "^17.3.1",
     "express": "^5.2.1",
+    "express-rate-limit": "^8.7.5",
+    "helmet": "^8.3.0",
     "jsonwebtoken": "^9.0.3",
     "multer": "^2.3.0",
```

### 2. `server/src/middleware/rateLimit.ts` (new file)

All rate limits in one place. Counters are kept in memory.

```ts
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
```

### 3. `server/src/app.ts`

Turns on Helmet, the general limit, no-store and the body size limit. `/health` comes before the limiter so Render's checks always pass.

```diff
@@ -2,6 +2,8 @@ import "dotenv/config";
 import express from "express";
 import cros from "cors";
+import helmet from "helmet";
 import cookieParser from "cookie-parser";
 import { notFound } from "./middleware/notFound";
+import { globalLimiter } from "./middleware/rateLimit";
 import { errorHandler } from "./middleware/errorHandler";
 import { authRouter } from "./modules/auth/auth.routes";
@@ -22,4 +24,9 @@ export function mainEntryFunction() {
   const app = express();
     
+  // How many proxies sit in front of the app, so req.ip is the caller's address
+  app.set("trust proxy", env.TRUST_PROXY_HOPS);
+
+  app.use(helmet());
+
   app.use(
     cros({
@@ -29,11 +36,21 @@ export function mainEntryFunction() {
   );
 
-  app.use(express.json());
-  app.use(cookieParser());
-
+  // Before the limiter: Render's health checks must never be refused
   app.get("/health", (_req, res) =>
     res.json(ok({ message: "server is healthy" })),
   );
 
+  // Before body parsing, so refused requests cost nothing
+  app.use(globalLimiter);
+
+  // Responses hold tokens and private data: never let a browser or proxy store them
+  app.use((_req, res, next) => {
+    res.set("Cache-Control", "no-store");
+    next();
+  });
+
+  app.use(express.json({ limit: "100kb" }));
+  app.use(cookieParser());
+
   //Auth
   app.use("/auth", authRouter);
```

### 4. `server/src/config/env.ts`

Checks the JWT secrets at startup and adds `TRUST_PROXY_HOPS`.

```diff
@@ -8,4 +8,6 @@ const schema = z.object({
   PORT: z.coerce.number().int().positive().default(5000),
   //   DATABASE_URL: z.string().url(),
+  // 0 = no proxy (local). See DEPLOYMENT.md for Render.
+  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
   LOG_LEVEL: z
     .enum(["trace", "debug", "info", "warn", "error", "fatal"])
@@ -16,6 +18,6 @@ const schema = z.object({
     .transform((v) => v.split(",").map((o) => o.trim())),
 
-  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
-  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
+  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
+  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
   ACCESS_TOKEN_TTL: z.string().default("15m"),
   REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
@@ -47,4 +49,8 @@ const schema = z.object({
   // to delete their existing messages (the owner still can).
   ANON_MESSAGE_SECRET: z.string().min(32, "ANON_MESSAGE_SECRET must be at least 32 characters"),
+}).refine((e) => e.JWT_SECRET !== e.JWT_REFRESH_SECRET, {
+  // With one shared secret a refresh token would also pass as an access token
+  message: "JWT_SECRET and JWT_REFRESH_SECRET must be different",
+  path: ["JWT_REFRESH_SECRET"],
 });
```

### 5. `server/src/middleware/errorHandler.ts`

Clear 413 error for oversized requests.

```diff
@@ -17,4 +17,8 @@ export function errorHandler(
   }
 
+  if (err?.type === "entity.too.large") {
+    return res.status(413).json(fail("Request body is too large", "BODY_TOO_LARGE"));
+  }
+
   console.log("error:", err);
   return res.status(500).json(fail("Internal Server Error", "INTERNAL_ERROR"));
```

### 6. `server/src/modules/auth/auth.routes.ts`

Applies the signup and login limits.

```diff
@@ -1,9 +1,10 @@
 import { Router } from "express";
+import { loginAccountLimiter, loginIpLimiter, signupLimiter } from "../../middleware/rateLimit";
 import * as authController from "./auth.controller";
 
 export const authRouter = Router();
 
-authRouter.post("/signup", authController.signup);
-authRouter.post("/login", authController.login);
+authRouter.post("/signup", signupLimiter, authController.signup);
+authRouter.post("/login", loginIpLimiter, loginAccountLimiter, authController.login);
 authRouter.post("/refresh", authController.refresh);
 authRouter.post("/logout", authController.logout);
```

### 7. `server/src/modules/auth/auth.service.ts`

Compares a dummy hash when there is no account, so timing gives less away.

```diff
@@ -14,4 +14,6 @@ import {
 
 const SALT_ROUNDS = 10;
+// Compared when there is no account, so response time does not reveal which emails exist
+const DUMMY_HASH = bcrypt.hashSync("no-such-account", SALT_ROUNDS);
 
 export type AuthResult = {
@@ -69,10 +71,6 @@ export async function login(input: LoginInput): Promise<AuthResult> {
   const user = await prisma.user.findUnique({ where: { email } });
   // Google-only accounts have no password
-  if (!user?.password) {
-    throw new AppError(401, "Invalid email or password");
-  }
-
-  const valid = await bcrypt.compare(input.password, user.password);
-  if (!valid) {
+  const valid = await bcrypt.compare(input.password, user?.password ?? DUMMY_HASH);
+  if (!user?.password || !valid) {
     throw new AppError(401, "Invalid email or password");
   }
```

### 8. `server/src/modules/auth/token.service.ts`

Accepts only `HS256` tokens.

```diff
@@ -28,5 +28,5 @@ export function signAccessToken(user: AuthUser): string {
 export function verifyAccessToken(token: string): AccessTokenPayload {
   try {
-    const decoded = jwt.verify(token, env.JWT_SECRET);
+    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
 
     if (typeof decoded === "string" || !decoded.sub) {
@@ -59,5 +59,5 @@ export function signRefreshToken(userId: string): { token: string; jti: string }
 export function verifyRefreshToken(token: string): RefreshTokenPayload {
   try {
-    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
+    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
 
     if (typeof decoded === "string" || !decoded.sub || !decoded.jti) {
```

### 9. `server/src/modules/user/user.routes.ts`

Applies the profile limit after login is checked.

```diff
@@ -1,4 +1,5 @@
 import { Router } from "express";
 import { requireAuth } from "../../middleware/requireAuth";
+import { profileLimiter } from "../../middleware/rateLimit";
 import { uploadImage } from "../../middleware/uploadImage";
 import * as userController from "./user.controller";
@@ -7,3 +8,3 @@ export const userRouter = Router();
 
 // requireAuth comes first so anonymous requests never get to upload a file
-userRouter.patch("/me", requireAuth, uploadImage, userController.updateMe);
+userRouter.patch("/me", requireAuth, profileLimiter, uploadImage, userController.updateMe);
```

### 10. `render.yaml`

Sets `TRUST_PROXY_HOPS` on Render.

```diff
@@ -10,4 +10,6 @@ services:
       - key: NODE_ENV
         value: production
+      - key: TRUST_PROXY_HOPS
+        value: "3"
       - key: DATABASE_URL
         sync: false
```

### 11. `server/src/app.security.test.ts` (new file)

Tests for headers, the per-account login limit and the 413 error.

```ts
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mainEntryFunction } from "./app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("./utils/prisma", () => ({ prisma: prismaMock }));

let server: Server;
let base: string;

beforeAll(async () => {
  server = mainEntryFunction().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const login = (email: string, forwardedFor: string) =>
  fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": forwardedFor },
    body: JSON.stringify({ email, password: "wrong" }),
  });

describe("security middleware", () => {
  it("sends security headers and no caching", async () => {
    const res = await fetch(`${base}/api/groups`);

    expect(res.status).toBe(401);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("limits failed logins per account, whatever IP is claimed", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login("a@x.com", `1.1.1.${i}`)).status).toBe(401);
    }

    const blocked = await login("A@X.com", "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ errors: [{ code: "RATE_LIMITED" }] });
    expect((await login("b@x.com", "9.9.9.9")).status).toBe(401);
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await fetch(`${base}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(200_000) }),
    });
    expect(res.status).toBe(413);
  });
});
```

`DEPLOYMENT.md` was also updated: the new variable, the secret rules and a troubleshooting row.

## Before deploying

1. Check the JWT secrets on Render. If either is under 32 characters, or both are the same, the server will not start. Changing them logs everyone out.
2. Set `TRUST_PROXY_HOPS` to `3` on Render if the service was created manually. The value 3 is not confirmed; if many users see "Too many requests", adjust it by 1.

## Known limits

- **Prisma:** `npm audit` still shows 3 high warnings from Prisma's command-line tool. The only offered fix downgrades to Prisma 6.
- **Login lockout:** someone can block password login for an account for up to 15 minutes by failing on purpose. Existing sessions and Google login still work.
- **Limits reset** when Render restarts or sleeps. Use Redis if you run more than one instance.
- **Not done:** longer minimum password (still 6) and security headers for the Vercel frontend.
