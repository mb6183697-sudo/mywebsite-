import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminCreateDepositAddress, useAdminDeleteDepositAddress, getGetDepositAddressesQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, Building2, Coins, Pencil, X, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  }).then(r => { if (!r.ok) return r.json().then(d => Promise.reject(d.message || "Hata")); return r.json(); });
}

interface DepositAddress {
  id: number;
  type: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  iban?: string;
  cryptoNetwork?: string;
  walletAddress?: string;
  label?: string;
  note?: string;
  isHidden?: boolean;
}

type AddressForm = {
  type: "bank" | "crypto";
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban: string;
  cryptoNetwork: string;
  walletAddress: string;
  note: string;
};

const emptyForm: AddressForm = {
  type: "bank",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  iban: "",
  cryptoNetwork: "",
  walletAddress: "",
  note: "",
};

function AddressFormFields({ form, onChange }: { form: AddressForm; onChange: (f: AddressForm) => void }) {
  const inp = "mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const lbl = "text-sm font-medium text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" type="button" variant={form.type === "bank" ? "default" : "outline"} onClick={() => onChange({ ...form, type: "bank" })}>
          <Building2 className="w-4 h-4 mr-1" /> Banka
        </Button>
        <Button size="sm" type="button" variant={form.type === "crypto" ? "default" : "outline"} onClick={() => onChange({ ...form, type: "crypto" })}>
          <Coins className="w-4 h-4 mr-1" /> Kripto
        </Button>
      </div>

      {form.type === "bank" ? (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Banka Adı</label>
            <Input placeholder="örn. Ziraat Bankası" value={form.bankName} onChange={e => onChange({ ...form, bankName: e.target.value })} className="bg-background mt-1" />
          </div>
          <div>
            <label className={lbl}>Hesap Adı (Alıcı)</label>
            <Input placeholder="Ad Soyad" value={form.accountHolder} onChange={e => onChange({ ...form, accountHolder: e.target.value })} className="bg-background mt-1" />
          </div>
          <div>
            <label className={lbl}>IBAN</label>
            <Input placeholder="TR00 0000 0000 0000 0000 0000 00" value={form.iban} onChange={e => onChange({ ...form, iban: e.target.value })} className="bg-background mt-1" />
          </div>
          <div>
            <label className={lbl}>Hesap No (opsiyonel)</label>
            <Input placeholder="Hesap numarası" value={form.accountNumber} onChange={e => onChange({ ...form, accountNumber: e.target.value })} className="bg-background mt-1" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={lbl}>Ağ</label>
            <Input placeholder="örn. ERC20, TRC20, BEP20" value={form.cryptoNetwork} onChange={e => onChange({ ...form, cryptoNetwork: e.target.value })} className="bg-background mt-1" />
          </div>
          <div>
            <label className={lbl}>Cüzdan Adresi</label>
            <Input placeholder="0x..." value={form.walletAddress} onChange={e => onChange({ ...form, walletAddress: e.target.value })} className="bg-background mt-1" />
          </div>
        </div>
      )}

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
          <AlertTriangle className="w-4 h-4" /> Önemli Not
        </label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-1">Bu alan kullanıcıya hesap bilgileri ile dekont yükleme alanının arasında belirgin şekilde gösterilir.</p>
        <textarea
          placeholder="örn. Açıklama kısmına adınızı ve soyadınızı yazmayı unutmayınız."
          value={form.note}
          onChange={e => onChange({ ...form, note: e.target.value })}
          rows={3}
          className={inp + " resize-none"}
        />
      </div>
    </div>
  );
}

function EditModal({ addr, onClose, onSuccess }: { addr: DepositAddress; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<AddressForm>({
    type: (addr.type as "bank" | "crypto") || "bank",
    bankName: addr.bankName || "",
    accountHolder: addr.accountHolder || "",
    accountNumber: addr.accountNumber || "",
    iban: addr.iban || "",
    cryptoNetwork: addr.cryptoNetwork || "",
    walletAddress: addr.walletAddress || "",
    note: addr.note || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      await apiFetch(`/admin/deposit-addresses/${addr.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          bankName: form.bankName || undefined,
          accountHolder: form.accountHolder || undefined,
          accountNumber: form.accountNumber || undefined,
          iban: form.iban || undefined,
          cryptoNetwork: form.cryptoNetwork || undefined,
          walletAddress: form.walletAddress || undefined,
          note: form.note || null,
        }),
      });
      onSuccess();
    } catch (e: unknown) {
      setError(String(e));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold">Adresi Düzenle</h3>
            <p className="text-xs text-muted-foreground">#{addr.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <AddressFormFields form={form} onChange={setForm} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
            <Button className="flex-1" onClick={handleSave} disabled={loading}>
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddressesSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: addresses, isLoading } = useQuery<DepositAddress[]>({
    queryKey: ["admin-deposit-addresses"],
    queryFn: () => apiFetch("/admin/deposit-addresses"),
  });

  const { mutate: createAddress } = useAdminCreateDepositAddress();
  const { mutate: deleteAddress } = useAdminDeleteDepositAddress();

  const [showForm, setShowForm] = useState(false);
  const [editAddr, setEditAddr] = useState<DepositAddress | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-deposit-addresses"] });
    queryClient.invalidateQueries({ queryKey: getGetDepositAddressesQueryKey() });
  };

  const handleSubmit = () => {
    if (form.type === "bank" && (!form.bankName || !form.iban)) {
      toast({ title: "Banka adı ve IBAN gerekli", variant: "destructive" });
      return;
    }
    if (form.type === "crypto" && (!form.cryptoNetwork || !form.walletAddress)) {
      toast({ title: "Ağ ve cüzdan adresi gerekli", variant: "destructive" });
      return;
    }
    createAddress({
      data: {
        type: form.type,
        bankName: form.bankName || undefined,
        accountHolder: form.accountHolder || undefined,
        accountNumber: form.accountNumber || undefined,
        iban: form.iban || undefined,
        cryptoNetwork: form.cryptoNetwork || undefined,
        walletAddress: form.walletAddress || undefined,
        note: form.note || undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Adres eklendi" });
        invalidate();
        setShowForm(false);
        setForm(emptyForm);
      },
      onError: () => toast({ title: "Hata oluştu", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Bu adresi silmek istediğinizden emin misiniz?")) return;
    deleteAddress({ id }, {
      onSuccess: () => {
        toast({ title: "Adres silindi" });
        invalidate();
      },
    });
  };

  const handleToggleVisibility = async (addr: DepositAddress) => {
    setTogglingId(addr.id);
    try {
      await apiFetch(`/admin/deposit-addresses/${addr.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isHidden: !addr.isHidden }),
      });
      toast({ title: addr.isHidden ? "Adres gösterildi" : "Adres gizlendi" });
      invalidate();
    } catch (e: unknown) {
      toast({ title: String(e), variant: "destructive" });
    }
    setTogglingId(null);
  };

  const handleEditSuccess = () => {
    toast({ title: "Adres güncellendi" });
    invalidate();
    setEditAddr(null);
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const items: DepositAddress[] = addresses || [];
  const bankAddresses = items.filter(a => a.type === "bank");
  const cryptoAddresses = items.filter(a => a.type === "crypto");

  const AddressActions = ({ addr }: { addr: DepositAddress }) => (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleToggleVisibility(addr)}
        disabled={togglingId === addr.id}
        title={addr.isHidden ? "Göster (Trading platformunda görünmez)" : "Gizle"}
        className={addr.isHidden ? "text-muted-foreground hover:text-foreground" : "text-green-400 hover:text-green-300"}
      >
        {addr.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditAddr(addr)} title="Düzenle">
        <Pencil className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(addr.id)} title="Sil">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kullanıcıların "Para Yükle" ekranında göreceği banka ve kripto adresleri</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Yeni Adres
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Yeni Adres Ekle</h3>
          <AddressFormFields form={form} onChange={setForm} />
          <div className="flex gap-2">
            <Button onClick={handleSubmit}>Kaydet</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>İptal</Button>
          </div>
        </div>
      )}

      {bankAddresses.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold">Banka Adresleri ({bankAddresses.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {bankAddresses.map((addr) => (
              <div key={addr.id} className={`px-5 py-4 flex items-start justify-between gap-3 transition-colors ${addr.isHidden ? "opacity-50 bg-secondary/10" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm">{addr.bankName}</div>
                    {addr.isHidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground font-medium">GİZLİ</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{addr.accountHolder}</div>
                  {addr.accountNumber && <div className="text-xs text-muted-foreground">Hesap No: {addr.accountNumber}</div>}
                  <div className="text-xs font-mono text-muted-foreground mt-1">{addr.iban}</div>
                  {addr.note && (
                    <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-amber-300">{addr.note}</span>
                    </div>
                  )}
                </div>
                <AddressActions addr={addr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {cryptoAddresses.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold">Kripto Adresleri ({cryptoAddresses.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {cryptoAddresses.map((addr) => (
              <div key={addr.id} className={`px-5 py-4 flex items-start justify-between gap-3 transition-colors ${addr.isHidden ? "opacity-50 bg-secondary/10" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm">{addr.cryptoNetwork}</div>
                    {addr.isHidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground font-medium">GİZLİ</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground mt-1 break-all">{addr.walletAddress}</div>
                  {addr.note && (
                    <div className="mt-2 flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-amber-300">{addr.note}</span>
                    </div>
                  )}
                </div>
                <AddressActions addr={addr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz adres eklenmemiş</p>
          <p className="text-xs mt-1">Kullanıcıların para yüklemesi için banka veya kripto adresi ekleyin</p>
        </div>
      )}

      {editAddr && (
        <EditModal addr={editAddr} onClose={() => setEditAddr(null)} onSuccess={handleEditSuccess} />
      )}
    </div>
  );
}
