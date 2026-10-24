import { apiGet, apiPost } from "@/api/api";
import type { AuthUser } from "@/lib/types";

// ─── Response shapes (matches API_DOCS.md) ───────────────────────────────────
interface AuthPayload {
  user: AuthUser;
  accessToken: string;
}

interface LogoutPayload {
  message: "Logged out";
}

// ─── Request body types ───────────────────────────────────────────────────────
export interface LoginBody {
  email: string;
  password: string;
}

export interface SignupBody {
  name: string;
  email: string;
  password: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

/** POST /auth/login */
export function login(body: LoginBody) {
  return apiPost<AuthPayload, LoginBody>("/auth/login", body);
}

/** POST /auth/signup */
export function signup(body: SignupBody) {
  return apiPost<AuthPayload, SignupBody>("/auth/signup", body);
}

/** POST /auth/logout — clears the HttpOnly cookie server-side */
export function logout() {
  return apiPost<LogoutPayload>("/auth/logout");
}

/**
 * POST /auth/refresh — uses the HttpOnly cookie automatically.
 * Call on app load to silently restore the session.
 */
export function refreshToken() {
  return apiPost<AuthPayload>("/auth/refresh");
}

/** GET /auth/me — requires a valid access token in the store */
export function getMe() {
  return apiGet<{ user: AuthUser }>("/auth/me");
}
