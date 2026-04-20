import { clearTokens, getRefreshToken, getToken, saveToken } from "./auth";

interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
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
  const { method = "GET", token, body, skipAuthRedirect = false, signal } = options;

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
    signal,
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
        signal,
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

/**
 * FormData(파일) 업로드 전용 클라이언트.
 *
 * apiClient와 동일한 401 자동 갱신 + 재시도 로직을 사용하지만
 * - Content-Type은 브라우저가 multipart boundary와 함께 자동 설정하도록 둔다
 * - 항상 localStorage의 최신 토큰을 사용 (React state stale 회피)
 * - 에러 응답이 JSON이 아닐 경우 status code를 표시
 *
 * NOTE: 같은 FormData 객체를 두 번 fetch에 넘기면 일부 구현에서 body
 * stream이 재사용되지 못할 수 있으므로 호출자는 retry-safe한 구조의
 * FormData를 넘기거나, 새로 생성하는 builder 함수를 사용해야 한다.
 * 이 함수는 builder 패턴을 받아 매 시도마다 새 FormData를 만든다.
 */
export async function uploadFormData<T>(
  url: string,
  buildFormData: () => FormData
): Promise<T> {
  const doFetch = (authToken: string | null) => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    return fetch(url, {
      method: "POST",
      headers,
      body: buildFormData(),
    });
  };

  let res = await doFetch(getToken());

  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      clearTokens();
      window.location.href = "/login";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  if (!res.ok) {
    let detail: unknown = `HTTP ${res.status}`;
    try {
      const parsed = await res.json();
      detail = parsed?.detail ?? detail;
    } catch {
      try {
        const txt = await res.text();
        if (txt) detail = txt;
      } catch {
        /* ignore */
      }
    }
    throw new Error(formatError(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
