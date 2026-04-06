import { useState, useEffect } from "react";
import { useAdminAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Shield, ShieldCheck, Key, X, UserCheck, Banknote, Megaphone, Star, BarChart2, HeadphonesIcon, Package, ClipboardList, Bell, Users, FileEdit, Crown } from "lucide-react";

const PERMISSION_GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: "Kullanıcı & Hesap",
    items: [
      { key: "users", label: "Kullanıcı Yönetimi" },
      { key: "balance_tx_edit", label: "İşlem Geçmişini Düzenleme" },
      { key: "tier_apps", label: "Tier & Hesap Başvuruları" },
    ],
  },
  {
    label: "Mali İşlemler",
    items: [
      { key: "deposits", label: "Para Yatırma Onayı" },
      { key: "withdrawals", label: "Para Çekme Onayı" },
    ],
  },
  {
    label: "Destek & İletişim",
    items: [
      { key: "support", label: "Destek Yönetimi" },
      { key: "notifications", label: "Bildirim Gönderme" },
      { key: "campaigns", label: "Kampanya Yönetimi" },
    ],
  },
  {
    label: "Platform Yönetimi",
    items: [
      { key: "stocks", label: "Hisse Yönetimi" },
      { key: "orders", label: "Emir Yönetimi" },
      { key: "expert_picks", label: "Uzman Önerileri" },
      { key: "stats", label: "İstatistikler" },
    ],
  },
];

const ALL_PERMISSION_LABELS: Record<string, string> = PERMISSION_GROUPS.reduce((acc, g) => {
  g.items.forEach(i => { acc[i.key] = i.label; });
  return acc;
}, {} as Record<string, string>);

const SUPER_EXCLUSIVE = [
  { icon: <Trash2 className="w-3.5 h-3.5" />, label: "Kullanıcı Hesabı Silme" },
  { icon: <Shield className="w-3.5 h-3.5" />, label: "Admin Hesapları Yönetimi" },
  { icon: <Crown className="w-3.5 h-3.5" />, label: "Süper Admin Ayrıcalıkları" },
];

interface AdminAccount {
  id: number;
  username: string;
  displayName: string;
  permissions: string[];
  isSuper: boolean;
  createdAt: string;
}

function getToken() {
  return localStorage.getItem("admin_auth_token") || "";
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "İşlem başarısız");
  }
  return res.json();
}

interface FormData {
  username: string;
  displayName: string;
  password: string;
  permissions: string[];
}

const emptyForm: FormData = {
  username: "",
  displayName: "",
  password: "",
  permissions: [],
};

export default function AdminAccountsSection() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/accounts");
      setAccounts(data);
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (acc: AdminAccount) => {
    setEditingId(acc.id);
    setForm({ username: acc.username, displayName: acc.displayName, password: "", permissions: [...acc.permissions] });
    setShowForm(true);
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim()) {
      toast({ title: "Hata", description: "Kullanıcı adı ve görünen ad gerekli", variant: "destructive" });
      return;
    }
    if (!editingId && !form.password) {
      toast({ title: "Hata", description: "Yeni admin için şifre gerekli", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        displayName: form.displayName,
        permissions: form.permissions,
      };
      if (!editingId) body.username = form.username;
      if (form.password) body.password = form.password;

      if (editingId) {
        await apiFetch(`/admin/accounts/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        toast({ title: "Güncellendi", description: "Admin hesabı güncellendi" });
      } else {
        await apiFetch("/admin/accounts", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Oluşturuldu", description: "Yeni admin hesabı oluşturuldu" });
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu admin hesabını silmek istediğinizden emin misiniz?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/admin/accounts/${id}`, { method: "DELETE" });
      toast({ title: "Silindi", description: "Admin hesabı silindi" });
      load();
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!user?.isSuper) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <ShieldCheck className="w-10 h-10 opacity-40" />
        <p>Bu bölüme yalnızca süper admin erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Admin Hesapları
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Alt admin hesapları oluşturun ve yetkilerini ayarlayın</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Yeni Admin Ekle
        </Button>
      </div>

      {/* Admin List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Henüz alt admin hesabı yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${acc.isSuper ? "bg-yellow-500/20" : "bg-primary/10"}`}>
                    {acc.isSuper ? <ShieldCheck className="w-5 h-5 text-yellow-500" /> : <Shield className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{acc.displayName}</span>
                      {acc.isSuper && <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs">Süper Admin</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Key className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm">{acc.username}</span>
                    </div>
                  </div>
                </div>
                {!acc.isSuper && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(acc)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(acc.id)} disabled={deletingId === acc.id}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Super admin: show grouped exclusive capabilities */}
              {acc.isSuper && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <div>
                    <p className="text-xs text-yellow-600 font-semibold uppercase tracking-wider mb-2">Süper Admin Özel Yetkileri</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUPER_EXCLUSIVE.map((item, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                          {item.icon}
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {PERMISSION_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1.5">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map(item => (
                          <Badge key={item.key} variant="secondary" className="text-xs">{item.label}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Regular admin: show assigned permissions grouped */}
              {!acc.isSuper && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  {acc.permissions.length === 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">YETKİLER</p>
                      <span className="text-xs text-muted-foreground italic">Yetki yok</span>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {PERMISSION_GROUPS.map(group => {
                        const assigned = group.items.filter(i => acc.permissions.includes(i.key));
                        if (assigned.length === 0) return null;
                        return (
                          <div key={group.label}>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{group.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {assigned.map(item => (
                                <Badge key={item.key} variant="secondary" className="text-xs">{item.label}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                {editingId ? "Admin Düzenle" : "Yeni Admin Ekle"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {!editingId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Kullanıcı Adı *</label>
                  <Input
                    value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="admin_ali"
                    className="bg-background"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Görünen Ad *</label>
                <Input
                  value={form.displayName}
                  onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="Ali Yılmaz"
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Şifre {editingId ? "(değiştirmek için doldurun)" : "*"}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="bg-background"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Yetkiler</label>
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">{group.label}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {group.items.map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(key)}
                            onChange={() => togglePermission(key)}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-foreground">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                İptal
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
