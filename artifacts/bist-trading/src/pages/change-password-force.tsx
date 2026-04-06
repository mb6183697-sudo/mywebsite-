import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";

export default function ChangePasswordForcePage() {
  const { user, refetchUser, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Hata", description: "Şifre en az 6 karakter olmalıdır", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Hata", description: "Şifreler uyuşmuyor", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: "__skip__", newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Hata", description: data.message || "Şifre değiştirilemedi", variant: "destructive" });
        return;
      }
      toast({ title: "Başarılı", description: "Şifreniz güncellendi. Lütfen yeni şifrenizle giriş yapın." });
      logout();
    } catch {
      toast({ title: "Hata", description: "Bir hata oluştu", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-2">
            <ShieldCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold">Şifre Değiştirme Zorunlu</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Hesabınıza yönetici tarafından geçici şifre atanmış. Devam etmek için lütfen yeni bir şifre belirleyin.
          </p>
          {user && (
            <p className="text-xs text-muted-foreground">
              Hesap: <span className="font-semibold">{user.firstName} {user.lastName}</span>
            </p>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  required
                  type="password"
                  placeholder="Yeni Şifre (en az 6 karakter)"
                  className="pl-12 h-14 rounded-xl border-2 focus:ring-4 focus:ring-primary/10"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  required
                  type="password"
                  placeholder="Yeni Şifre (tekrar)"
                  className="pl-12 h-14 rounded-xl border-2 focus:ring-4 focus:ring-primary/10"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-base font-bold rounded-xl"
            >
              {isLoading ? "Kaydediliyor..." : "Şifremi Güncelle"} <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Çıkış yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
