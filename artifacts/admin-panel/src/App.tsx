import { useState, useEffect, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";

const queryClient = new QueryClient();

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isAdmin: true;
  isSuper: boolean;
  adminPermissions: string[];
  [key: string]: unknown;
}

interface AuthCtx {
  user: AdminUser | null;
  isLoading: boolean;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  isLoading: true,
  logout: () => {},
  hasPermission: () => false,
});

export function useAdminAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_auth_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        // Only accept tokens from the new admin_accounts system (isAdminAccount must be exactly true)
        if (data.isAdminAccount === true) {
          setUser({
            id: data.id,
            username: data.username || "",
            displayName: data.displayName || "Admin",
            isAdmin: true,
            isSuper: data.isSuper || false,
            adminPermissions: data.adminPermissions || [],
          });
        } else {
          // Old-style user token or regular user — force re-login with new system
          localStorage.removeItem("admin_auth_token");
        }
      })
      .catch(() => {
        localStorage.removeItem("admin_auth_token");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("admin_auth_token");
    setUser(null);
    queryClient.clear();
  };

  const handleLogin = (token: string, adminData: any) => {
    localStorage.setItem("admin_auth_token", token);
    setUser({
      id: adminData.id,
      username: adminData.username,
      displayName: adminData.displayName,
      isAdmin: true,
      isSuper: adminData.isSuper || false,
      adminPermissions: adminData.permissions || [],
    });
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.isSuper) return true;
    return user.adminPermissions.includes(perm);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
