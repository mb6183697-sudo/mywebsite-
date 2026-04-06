import { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  );

  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!token,
      retry: false,
    },
  });

  // Sync token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }, [token]);

  // Handle auth failures — only redirect if query finished AND returned an error
  useEffect(() => {
    if (token && !isLoading && isError) {
      setToken(null);
      setLocation("/auth");
    }
  }, [token, isLoading, isError, setLocation]);

  // Force password change if required
  useEffect(() => {
    if (user?.mustChangePassword) {
      setLocation("/sifre-degistir");
    }
  }, [user?.mustChangePassword, setLocation]);

  // Heartbeat — send every 30s while logged in so admin can see online status
  useEffect(() => {
    if (!token || !user) return;
    const ping = () => fetch("/api/auth/heartbeat", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [token, user]);

  const login = (newToken: string) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setLocation("/auth");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: !!token && isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refetchUser: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
