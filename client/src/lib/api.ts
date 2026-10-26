import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiEnvelope } from "@/lib/types";
import { env } from "@/lib/env";

// ─── Token getter (injected by auth store to avoid circular imports) ──────────
let tokenGetter: (() => string | null) | null = null;

/** Call this once in your auth store setup to wire up the access token. */
export function setTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
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
