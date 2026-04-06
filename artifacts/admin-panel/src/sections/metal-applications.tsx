import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Gem, RefreshCw, AlertTriangle, WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetalApp {
  id: number;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  metalApplicationStatus: string;
  createdAt: string;
  balance: number;
  isIdentityVerified: boolean;
}

interface MetalAccount {
  id: number;
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  balance: number;
  metalParentId: number;
  leverage: number;
  createdAt: string;
  parentName?: string;
  // portfolio metrics
  equity?: number;
  usedMargin?: number;
  freeMargin?: number;
  marginLevel?: number;
}

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || data.error || String(r.status));
    return data;
  });
}

const fmt = (n: number | null | undefined) => `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

export default function MetalApplicationsSection() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "accounts">("pending");
  const [apps, setApps] = useState<MetalApp[]>([]);
  const [accounts, setAccounts] = useState<MetalAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsData, accountsData] = await Promise.all([
        apiFetch("/admin/metal-applications"),
        apiFetch("/admin/metal-accounts"),
      ]);
      setApps(appsData.applications || []);
      setAccounts(accountsData.accounts || []);
    } catch (e: any) {
      toast({ title: "Yükleme hatası", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApprove = async (userId: number) => {
    setProcessing(userId);
    try {
      const res = await apiFetch(`/admin/metal-applications/${userId}/approve`, { method: "POST" });
      toast({ title: "Onaylandı", description: res.message });
      loadData();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId: number) => {
    if (!confirm("Bu başvuruyu reddetmek istediğinizden emin misiniz?")) return;
    setProcessing(userId);
    try {
      const res = await apiFetch(`/admin/metal-applications/${userId}/reject`, { method: "POST" });
      toast({ title: "Reddedildi", description: res.message });
      loadData();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const pendingApps = apps.filter(a => a.metalApplicationStatus === "pending");
  const marginCallAccounts = accounts.filter(a => a.marginLevel !== undefined && a.marginLevel < 100);
  // Onaylandı ama asıl metal alt hesabı oluşturulmamış (orphan) kullanıcılar
  const orphanedApps = apps.filter(a =>
    a.metalApplicationStatus === "approved" &&
    !accounts.some(acc => acc.metalParentId === a.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Değerli Metaller</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      {/* Margin Call Alert */}
      {marginCallAccounts.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-destructive">Margin Call Uyarısı</p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {marginCallAccounts.length} hesabın teminat seviyesi %100'ün altına düştü.
            </p>
            <div className="mt-2 space-y-1">
              {marginCallAccounts.map(a => (
                <div key={a.id} className="text-xs font-mono text-destructive">
                  #{a.accountId} — {a.firstName} {a.lastName} — Seviye: {(a.marginLevel ?? 0).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === "pending" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Clock className="w-4 h-4" />
          Bekleyen Başvurular
          {pendingApps.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingApps.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("accounts")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === "accounts" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Gem className="w-4 h-4" />
          Aktif Hesaplar
          <span className="text-xs text-muted-foreground">({accounts.length})</span>
        </button>
      </div>

      {/* Orphaned Approvals Alert */}
      {tab === "pending" && orphanedApps.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <WrenchIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-500">Eksik Metal Hesap Tespit Edildi</p>
              <p className="text-sm text-amber-500/80 mt-0.5">
                Aşağıdaki kullanıcı(lar) onaylandı ancak metal alt hesabı oluşturulmadı. "Hesap Oluştur" butonuna tıklayarak onarın.
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-500/20">
            {orphanedApps.map(app => (
              <div key={app.id} className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-sm">{app.firstName} {app.lastName}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">#{app.accountId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{app.email}</span>
                </div>
                <Button
                  size="sm"
                  disabled={processing === app.id}
                  onClick={() => handleApprove(app.id)}
                  className="bg-amber-500 hover:bg-amber-600 text-white h-8 shrink-0"
                >
                  <WrenchIcon className="w-3.5 h-3.5 mr-1.5" />
                  Hesap Oluştur
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Applications Tab */}
      {tab === "pending" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
          ) : pendingApps.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>Bekleyen başvuru bulunmuyor.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingApps.map(app => (
                <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base">{app.firstName} {app.lastName}</span>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">#{app.accountId}</span>
                      {app.isIdentityVerified ? (
                        <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full">KYC Onaylı</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">KYC Yok</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
                      <span>{app.email}</span>
                      <span>Bakiye: {fmt(app.balance)}</span>
                      <span>Başvuru: {fmtDate(app.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      disabled={processing === app.id}
                      onClick={() => handleApprove(app.id)}
                      className="bg-success hover:bg-success/90 text-white h-9"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processing === app.id}
                      onClick={() => handleReject(app.id)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 h-9"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reddet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Accounts Tab */}
      {tab === "accounts" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Gem className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>Henüz aktif metal hesap bulunmuyor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Hesap</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Ana Hesap</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Bakiye</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Özkaynaklar</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Kullanılan Teminat</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Teminat Seviyesi</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Kaldıraç</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {accounts.map(acc => {
                    const ml = acc.marginLevel ?? null;
                    const isMarginCall = ml !== null && ml < 100;
                    return (
                      <tr key={acc.id} className={`hover:bg-muted/20 ${isMarginCall ? "bg-destructive/5" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold">{acc.firstName} {acc.lastName}</div>
                          <div className="text-xs text-muted-foreground font-mono">#{acc.accountId}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {acc.parentName || `ID#${acc.metalParentId}`}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{fmt(acc.balance)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{acc.equity != null ? fmt(acc.equity) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{acc.usedMargin != null ? fmt(acc.usedMargin) : "—"}</td>
                        <td className={`px-4 py-3 text-right font-bold tabular-nums ${isMarginCall ? "text-destructive" : ml !== null && ml < 200 ? "text-amber-500" : "text-success"}`}>
                          {ml !== null ? `${ml.toFixed(1)}%` : "—"}
                          {isMarginCall && <span className="ml-1 text-[10px] bg-destructive text-white px-1.5 py-0.5 rounded-full">MC</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                            1:{acc.leverage ?? 200}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
