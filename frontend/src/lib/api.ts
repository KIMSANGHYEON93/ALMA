import { clearTokens } from "./auth";

interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  skipAuthRedirect?: boolean;
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

  if (res.status === 401 && !skipAuthRedirect) {
    clearTokens();
    window.location.href = "/login";
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "요청 실패" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
