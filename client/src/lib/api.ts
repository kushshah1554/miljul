import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiEnvelope, AuthUser } from "@/lib/types";
import { env } from "@/lib/env";

// ─── Token getter (injected by auth store to avoid circular imports) ──────────
let tokenGetter: (() => string | null) | null = null;

/** Call this once in your auth store setup to wire up the access token. */
export function setTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

// ─── Session handlers (injected by auth store, same reason as above) ─────────
interface SessionHandlers {
  onRefreshed: (user: AuthUser, accessToken: string) => void;
  onExpired: () => void;
}
let sessionHandlers: SessionHandlers | null = null;

export function setSessionHandlers(handlers: SessionHandlers) {
  sessionHandlers = handlers;
}

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: env.backendUrl,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // required so HttpOnly refresh-token cookie is sent
});

// ─── Request interceptor – attach Bearer token ────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (tokenGetter) {
    const token = tokenGetter();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Silent refresh ───────────────────────────────────────────────────────────
// The server rotates the refresh token on every use, so parallel refresh calls
// would invalidate each other. All callers share one in-flight request instead.
let refreshing: Promise<{ user: AuthUser; accessToken: string }> | null = null;

export function refreshSession() {
  refreshing ??= request<{ user: AuthUser; accessToken: string }>({
    method: "post",
    url: "/auth/refresh",
  })
    .then((payload) => {
      sessionHandlers?.onRefreshed(payload.user, payload.accessToken);
      return payload;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// A 401 from these means bad credentials / no session, not an expired access token
const NO_RETRY_URLS = ["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout"];

// ─── Response interceptor – refresh once on 401, then replay the request ─────
api.interceptors.response.use(undefined, async (err) => {
  const config = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (
    err.response?.status !== 401 ||
    !config ||
    config._retried ||
    NO_RETRY_URLS.includes(config.url ?? "")
  ) {
    throw err;
  }
  config._retried = true;
  try {
    await refreshSession();
  } catch {
    sessionHandlers?.onExpired(); // refresh token is dead too → log out
    throw err;
  }
  return api.request(config); // request interceptor attaches the new token
});

// ─── Error normaliser ─────────────────────────────────────────────────────────
// Always returns an Error with a human-readable message.
// Attaches the original as `cause` so the full stack trace is preserved.
function normaliseError(err: unknown): Error {
  if (axios.isAxiosError(err)) {
    const apiMsg = err.response?.data?.errors?.[0]?.message as string | undefined;
    const msg = apiMsg ?? err.message ?? "Request failed";
    return new Error(msg, { cause: err });
  }
  if (err instanceof Error) return err; // already an Error — return as-is
  return new Error("Request failed", { cause: err });
}

// ─── Envelope unwrapping (shared by every helper below) ─────────────────────
async function requestWithMeta<TResponse>(
  config: AxiosRequestConfig,
): Promise<{ data: TResponse; meta: ApiEnvelope<TResponse>["meta"] }> {
  try {
    const res = await api.request<ApiEnvelope<TResponse>>(config);
    // 204 No Content (e.g. DELETE member) has no envelope to unwrap
    if (res.status === 204) return { data: undefined as TResponse, meta: undefined };
    if (res.data.status === "error" || res.data.data == null) {
      throw new Error(res.data.errors?.[0]?.message ?? "Response error");
    }
    return { data: res.data.data, meta: res.data.meta };
  } catch (err) {
    throw normaliseError(err);
  }
}

async function request<TResponse>(config: AxiosRequestConfig): Promise<TResponse> {
  return (await requestWithMeta<TResponse>(config)).data;
}

// ─── Generic helpers ─────────────────────────────────────────────────────────
export function apiGet<TResponse>(url: string, config?: AxiosRequestConfig) {
  return request<TResponse>({ ...config, method: "get", url });
}

/** GET that also returns the envelope's `meta` (e.g. pagination). */
export function apiGetWithMeta<TResponse, TMeta>(url: string, config?: AxiosRequestConfig) {
  return requestWithMeta<TResponse>({ ...config, method: "get", url }) as Promise<{
    data: TResponse;
    meta: TMeta;
  }>;
}

export function apiPost<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  return request<TResponse>({ ...config, method: "post", url, data: body });
}

export function apiPatch<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  return request<TResponse>({ ...config, method: "patch", url, data: body });
}

export function apiPut<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
) {
  return request<TResponse>({ ...config, method: "put", url, data: body });
}

export function apiDelete<TResponse = void>(
  url: string,
  config?: AxiosRequestConfig,
) {
  return request<TResponse>({ ...config, method: "delete", url });
}

export default api;
