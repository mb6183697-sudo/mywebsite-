import { useState, useEffect } from "react";
import { Users, Shield, Plus, ChevronRight, Trash2, RefreshCw, Key, Hash, UserCheck, Building2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/App";

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  }).then(r => { if (!r.ok) return r.json().then(d => Promise.reject(d.message || "Hata")); return r.json(); });
}

const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
};

interface IBUser {
  id: number;
  accountId: string;
  firstName: string;
  lastName: string;
  phone: string;
  balance: number;
  ibAllocatedBalance: number;
  ibReferralCode: string | null;
  ibAuthorizedAt: string | null;
  subAccountCount: number;
  referredCount: number;
  accountType: string;
}

interface SubAccount {
  id: number;
  accountId: string;
  firstName: string;
  balance: number;
  frozenBalance: number;
  subAccountName: string | null;
}

interface ReferredUser {
  id: number;
  accountId: string;
  firstName: string;
  lastName: string;
  phone: string;
  balance: number;
  accountType: string;
  createdAt: string;
}

function IBDetailDrawer({ ib, onClose }: { ib: IBUser; onClose: () => void }) {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"subs" | "referred">("referred");

  useEffect(() => {
    apiFetch(`/admin/ib/${ib.id}/sub-accounts`)
      .then(data => {
        setSubAccounts(data.subAccounts || []);
        setReferredUsers(data.referredUsers || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [ib.id]);

  return (
    <div className="mt-3 bg-muted/20 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex gap-1">
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === "referred" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("referred")}
          >
            Referans ile Gelenler ({referredUsers.length})
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === "subs" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("subs")}
          >
            Alt Hesaplar ({subAccounts.length})
          </button>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded">Kapat</button>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Yükleniyor...</div>
        ) : activeTab === "referred" ? (
          referredUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Henüz referans ile gelen hesap yok.</p>
              <p className="text-xs mt-1">Referans kodu: <span className="font-mono font-bold text-primary">{ib.ibReferralCode || "—"}</span></p>
            </div>
          ) : (
            <div className="space-y-2">
              {referredUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{u.accountId} · {u.phone}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(u.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{fmtCurrency(u.balance)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{u.accountType}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          subAccounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Henüz alt hesap yok.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subAccounts.map(sub => (
                <div key={sub.id} className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{sub.subAccountName || sub.firstName}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{sub.accountId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{fmtCurrency(sub.balance)}</div>
                    {sub.frozenBalance > 0 && (
                      <div className="text-xs text-muted-foreground">{fmtCurrency(sub.frozenBalance)} kilitli</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function IBSection() {
  const { user: adminUser } = useAdminAuth();
  const { toast } = useToast();
  const [ibUsers, setIbUsers] = useState<IBUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // Create IB form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    accountNumber: "",
    password: "",
    referralCode: "",
    displayName: "",
    allocatedBalance: "10000000",
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadIBUsers = () => {
    setIsLoading(true);
    apiFetch("/admin/ib")
      .then(data => setIbUsers(data.ibUsers || []))
      .catch(e => toast({ title: "Hata", description: e, variant: "destructive" }))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadIBUsers(); }, []);

  const handleCreate = async () => {
    if (!createForm.accountNumber.trim()) return toast({ title: "Hesap numarası gerekli", variant: "destructive" });
    if (!createForm.password.trim()) return toast({ title: "Şifre gerekli", variant: "destructive" });
    if (!createForm.referralCode.trim()) return toast({ title: "Referans kodu gerekli", variant: "destructive" });

    setIsCreating(true);
    try {
      const result = await apiFetch("/admin/ib/create", {
        method: "POST",
        body: JSON.stringify({
          accountNumber: createForm.accountNumber.trim().toUpperCase(),
          password: createForm.password.trim(),
          referralCode: createForm.referralCode.trim().toUpperCase(),
          displayName: createForm.displayName.trim(),
          allocatedBalance: Number(createForm.allocatedBalance) || 10_000_000,
        }),
      });
      toast({ title: "IB Hesabı Oluşturuldu", description: result.message });
      setCreateForm({ accountNumber: "", password: "", referralCode: "", displayName: "", allocatedBalance: "10000000" });
      setShowCreateForm(false);
      loadIBUsers();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (userId: number, name: string) => {
    if (!confirm(`"${name}" hesabının IB yetkisini kaldırmak istediğinizden emin misiniz?`)) return;
    setRevokingId(userId);
    try {
      await apiFetch(`/admin/ib/${userId}/revoke`, { method: "DELETE" });
      toast({ title: "IB Yetkisi Kaldırıldı" });
      loadIBUsers();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  if (!adminUser?.isSuper) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
        <Shield className="w-12 h-12 opacity-30" />
        <p className="font-medium">Bu bölüme yalnızca Süper Admin erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">IB Kadrosu</h3>
          <p className="text-sm text-muted-foreground">Introducing Broker hesaplarını yönetin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadIBUsers}>
            <RefreshCw className="w-4 h-4 mr-2" /> Yenile
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(v => !v)}>
            <Plus className="w-4 h-4 mr-2" /> Yeni IB Ekle
          </Button>
        </div>
      </div>

      {/* Create IB Form */}
      {showCreateForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Building2 className="w-4 h-4 text-primary" /> Yeni IB Hesabı Oluştur
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hesap Numarası *</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 uppercase"
                  placeholder="örn. IB001"
                  value={createForm.accountNumber}
                  onChange={e => setCreateForm(f => ({ ...f, accountNumber: e.target.value.toUpperCase() }))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">IB bu numarayla giriş yapar</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Şifre *</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  type="text"
                  placeholder="Güçlü bir şifre girin"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Referans Kodu *</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9 uppercase"
                  placeholder="örn. IBREF001"
                  value={createForm.referralCode}
                  onChange={e => setCreateForm(f => ({ ...f, referralCode: e.target.value.toUpperCase() }))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Kullanıcılar kayıtta bunu girer</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Görünen İsim</label>
              <Input
                placeholder="IB adı veya şirket"
                value={createForm.displayName}
                onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Havuz Bakiyesi (₺)</label>
              <Input
                type="number"
                value={createForm.allocatedBalance}
                onChange={e => setCreateForm(f => ({ ...f, allocatedBalance: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Oluşturuluyor..." : "IB Hesabı Oluştur"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>İptal</Button>
          </div>
        </div>
      )}

      {/* IB Users List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Yükleniyor...</div>
        ) : ibUsers.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Henüz IB hesabı yok</p>
            <p className="text-sm text-muted-foreground mt-1">Yukarıdan yeni IB ekleyin</p>
          </div>
        ) : (
          ibUsers.map(ib => (
            <div key={ib.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {ib.firstName[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                      {ib.firstName} {ib.lastName}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">IB</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono font-bold text-primary">#{ib.accountId}</span>
                      {ib.ibReferralCode && (
                        <>
                          <span>·</span>
                          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                            REF: {ib.ibReferralCode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-foreground">{fmtCurrency(ib.balance)}</div>
                    <div className="text-xs text-muted-foreground">Havuz: {fmtCurrency(ib.ibAllocatedBalance)}</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-foreground">{ib.referredCount}</div>
                    <div className="text-xs text-muted-foreground">Referans</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-muted-foreground">Yetki Tarihi</div>
                    <div className="text-xs font-medium">{fmtDate(ib.ibAuthorizedAt)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedId(expandedId === ib.id ? null : ib.id)}
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform mr-1 ${expandedId === ib.id ? "rotate-90" : ""}`} />
                      Detay
                    </Button>
                    <button
                      onClick={() => handleRevoke(ib.id, ib.firstName)}
                      disabled={revokingId === ib.id}
                      title="IB Yetkisini Kaldır"
                      className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === ib.id && (
                <div className="px-4 pb-4">
                  <IBDetailDrawer ib={ib} onClose={() => setExpandedId(null)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
