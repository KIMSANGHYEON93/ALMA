import { clearTokens, getRefreshToken, saveToken } from "./auth";

interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  skipAuthRedirect?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    saveToken(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiClient<T>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", token, body, skipAuthRedirect = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401: 토큰 갱신 시도
  if (res.status === 401 && !skipAuthRedirect && token) {
    // 동시 요청 중복 방지
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (newToken) {
      // 갱신 성공 → 원래 요청 재시도
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (retryRes.status === 204) return undefined as T;
      if (!retryRes.ok) {
        const error = await retryRes.json().catch(() => ({ detail: "요청 실패" }));
        throw new Error(formatError(error.detail));
      }
      return retryRes.json();
    }

    // 갱신 실패 → 로그인 리다이렉트
    clearTokens();
    window.location.href = "/login";
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (res.status === 401 && !skipAuthRedirect) {
    clearTokens();
    window.location.href = "/login";
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "요청 실패" }));
    throw new Error(formatError(error.detail));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg || "").join(", ");
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return "요청 실패";
}
