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
  });
}

export function saveToken(access: string, refresh: string): void {
  localStorage.setItem("alma_access_token", access);
  localStorage.setItem("alma_refresh_token", refresh);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("alma_access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("alma_refresh_token");
}

export function clearTokens(): void {
  localStorage.removeItem("alma_access_token");
  localStorage.removeItem("alma_refresh_token");
}
