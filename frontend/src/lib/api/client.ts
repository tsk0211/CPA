// Direct port of lib/api/api_client.dart's behavior: owns the access/refresh
// tokens (persisted in localStorage — the web equivalent of the mobile app's
// flutter_secure_storage), attaches the bearer header, and transparently
// refreshes once on a 401 before retrying. Callers never see the token
// lifecycle — they just call get/post/patch/delete and get JSON back (or an
// ApiException/NetworkUnavailableException).

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "cpa_access_token";
const REFRESH_TOKEN_KEY = "cpa_refresh_token";

export class ApiException extends Error {
  statusCode: number;
  code?: string;
  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Thrown when a request fails because there's no network path to the server
// at all (not a server-side error response).
export class NetworkUnavailableException extends Error {
  constructor() {
    super("network unavailable");
  }
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setOnSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler;
}

export function loadPersistedTokens() {
  if (typeof window === "undefined") return;
  accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return refreshToken !== null;
}

function persistTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

// Unauthenticated, short-timeout ping at GET /health — never throws: a
// down/unreachable/still-booting server is just `false`.
export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function attempt(method: string, path: string, body?: unknown, query?: Record<string, string | undefined>, auth = true): Promise<Response> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  try {
    return await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch throws TypeError on a connection failure (host unreachable,
    // refused, DNS failure, CORS-blocked) — the one case safe to treat as
    // "no network path", mirroring the Dart client's http.ClientException catch.
    throw new NetworkUnavailableException();
  }
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await attempt("POST", "/auth/refresh", { refreshToken }, undefined, false);
    if (res.status !== 200) {
      clearTokens();
      return false;
    }
    const json = await res.json();
    persistTokens(json.accessToken, json.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function apiExceptionFrom(res: Response): Promise<ApiException> {
  try {
    const json = await res.json();
    return new ApiException(res.status, json.error ?? "request failed", json.code);
  } catch {
    return new ApiException(res.status, `request failed (${res.status})`);
  }
}

async function send(method: string, path: string, body?: unknown, query?: Record<string, string | undefined>, auth = true): Promise<Response> {
  let res = await attempt(method, path, body, query, auth);

  // One transparent refresh-and-retry on an expired access token. Skip for
  // the auth endpoints themselves to avoid a refresh loop.
  if (res.status === 401 && auth && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await refresh();
    if (!refreshed) {
      sessionExpiredHandler?.();
      throw new ApiException(401, "session expired, please log in again");
    }
    res = await attempt(method, path, body, query, auth);
  }

  if (res.status >= 400) throw await apiExceptionFrom(res);
  return res;
}

// decode()'s actual return shape depends entirely on which endpoint was
// called; every api.get/post/patch call site immediately casts its result
// to a specific type (see lib/api/projects.ts etc.), so this is a
// deliberate thin-wrapper boundary, not an accidental any leaking through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function decode(res: Response): Promise<any> {
  const text = await res.text();
  return text.length ? JSON.parse(text) : {};
}

export const api = {
  async get(path: string, query?: Record<string, string | undefined>) {
    return decode(await send("GET", path, undefined, query));
  },
  async post(path: string, body?: unknown) {
    return decode(await send("POST", path, body));
  },
  async patch(path: string, body?: unknown) {
    return decode(await send("PATCH", path, body));
  },
  async delete(path: string) {
    await send("DELETE", path);
  },
  // For CSV/XLSX export downloads — returns the raw blob plus the filename
  // the server suggested via Content-Disposition.
  async getBlob(path: string, query?: Record<string, string | undefined>): Promise<{ blob: Blob; filename: string }> {
    const res = await send("GET", path, undefined, query);
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? "export";
    return { blob: await res.blob(), filename };
  },
};

export async function login(email: string, password: string, rememberMe: boolean): Promise<AppUserJson> {
  const res = await attempt("POST", "/auth/login", { email, password, rememberMe }, undefined, false);
  if (res.status >= 400) throw await apiExceptionFrom(res);
  const json = await decode(res);
  persistTokens(json.accessToken as string, json.refreshToken as string);
  return json.user as AppUserJson;
}

export async function logout() {
  if (refreshToken) {
    try {
      await attempt("POST", "/auth/logout", { refreshToken });
    } catch {
      // best-effort — clear local session regardless
    }
  }
  clearTokens();
}

type AppUserJson = { id: string; name: string; email: string; role: string; mustChangePassword: boolean };
