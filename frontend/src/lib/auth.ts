import { apiClient } from "./api";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function login(
  email: string,
  password: string
): Promise<TokenResponse> {
  return apiClient<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuthRedirect: true,
  });
}

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<TokenResponse> {
  return apiClient<TokenResponse>("/api/auth/register", {
    method: "POST",
    body: { email, password, display_name: displayName },
    skipAuthRedirect: true,
  });
}

function notifyTokenChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("vivara:token-changed"));
}

export function saveToken(access: string, refresh: string): void {
  if (!access || !refresh) return;
  localStorage.setItem("alma_access_token", access);
  localStorage.setItem("alma_refresh_token", refresh);

  // middleware(서버 사이드)에서 인증 확인할 수 있도록 cookie에도 저장
  document.cookie = `alma_access_token=${access}; path=/; SameSite=Lax; max-age=86400`;

  notifyTokenChanged();
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("alma_access_token");
  return token && token.length > 0 ? token : null;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("alma_refresh_token");
}

export async function findAccount(
  email: string
): Promise<{ found: boolean; email?: string }> {
  return apiClient("/api/auth/find-account", {
    method: "POST",
    body: { email },
    skipAuthRedirect: true,
  });
}

export async function resetPassword(
  email: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiClient("/api/auth/reset-password", {
    method: "POST",
    body: { email, new_password: newPassword },
    skipAuthRedirect: true,
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiClient("/api/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function clearTokens(): void {
  localStorage.removeItem("alma_access_token");
  localStorage.removeItem("alma_refresh_token");

  // cookie도 함께 삭제
  document.cookie =
    "alma_access_token=; path=/; SameSite=Lax; max-age=0";

  notifyTokenChanged();
}
