import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, User } from "lucide-react";

interface LoginPageProps {
  onLogin: (token: string, admin: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Giriş başarısız");
        return;
      }

      onLogin(data.token, data.admin);
    } catch {
      setError("Sunucu hatası, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">1000 Yatırımlar</h1>
          <p className="text-muted-foreground text-sm mt-1">Admin Panel Girişi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Kullanıcı Adı</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="pl-10 bg-card border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pl-10 bg-card border-border"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !username || !password}>
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>
      </div>
    </div>
  );
}
