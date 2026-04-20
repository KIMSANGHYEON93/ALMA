"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncTokenFromStorage = useCallback(() => {
    setToken(getToken());
  }, []);

  useEffect(() => {
    syncTokenFromStorage();
    setIsLoading(false);

    // (1) 같은 탭에서 saveToken/clearTokens 호출 시 dispatch되는 커스텀 이벤트
    const onTokenChanged = () => syncTokenFromStorage();
    window.addEventListener(TOKEN_CHANGED_EVENT, onTokenChanged);

    // (2) 다른 탭/창에서 localStorage가 바뀔 때 발생하는 storage 이벤트
    const onStorage = (e: StorageEvent) => {
      if (e.key === "alma_access_token" || e.key === null) {
        syncTokenFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(TOKEN_CHANGED_EVENT, onTokenChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncTokenFromStorage]);

  const logout = () => {
    clearTokens();
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
