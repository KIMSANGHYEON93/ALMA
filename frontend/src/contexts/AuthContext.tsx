"use client";

import {
  createContext,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setToken(getToken());
    setIsLoading(false);
  }, []);

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
