"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  ReactNode,
} from "react";
import { getToken, clearTokens } from "@/lib/auth";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  logout: () => {},
});

export const TOKEN_CHANGED_EVENT = "vivara:token-changed";

function getServerToken(): string | null {
  return null;
}

function subscribeToToken(callback: () => void): () => void {
  // (1) 같은 탭에서 saveToken/clearTokens 호출 시 dispatch되는 커스텀 이벤트
  window.addEventListener(TOKEN_CHANGED_EVENT, callback);

  // (2) 다른 탭/창에서 localStorage가 바뀔 때 발생하는 storage 이벤트
  const onStorage = (e: StorageEvent) => {
    if (e.key === "alma_access_token" || e.key === null) callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(TOKEN_CHANGED_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

// 서버 렌더 시점엔 항상 false — 클라이언트에서 실제 토큰 스냅샷을 읽은 순간(하이드레이션
// 직후, 페인트 전) true로 바뀐다. 기존 "mount effect가 끝나야 true" 타이밍과 동일하되
// setState-in-effect 없이 얻는다.
function subscribeHydrated(): () => void {
  return () => {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeToToken, getToken, getServerToken);
  const isHydrated = useSyncExternalStore(subscribeHydrated, () => true, () => false);
  const isLoading = !isHydrated;

  const logout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
