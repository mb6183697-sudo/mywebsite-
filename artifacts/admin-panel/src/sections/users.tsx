import { useState, useEffect, useRef } from "react";
import {
  useAdminGetUsers,
  useAdminGetUser,
  useAdminVerifyIdentity,
  useAdminUpdateUser,
  useAdminUpdateBalance,
  getAdminGetUserQueryKey,
  getAdminGetUsersQueryKey,
  getAdminGetStatsQueryKey,
  User,
  Order,
  BalanceTransaction,
  AdminUpdateUserRequest,
} from "@workspace/api-client-react";
import { Search, X, RefreshCw, CheckCircle2, XCircle, Wallet, ArrowUpDown, Edit2, RotateCcw, Plus, Trash2, Pencil, Building2, ArrowRightLeft, Loader2, Ban, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/App";

type TabType = "account" | "open" | "orders" | "closed" | "ledgers" | "metal";

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  }).then(r => { if (!r.ok) return r.json().then(d => Promise.reject(d.message || "Hata")); return r.json(); });
}

const toLocalDt = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

// Human-readable datetime: YYYY-MM-DD HH:MM (space-separated, no T)
const toDisplayDt = (iso: string | null | undefined) => {
  if (!iso) return "";
  return toLocalDt(iso).replace("T", " ");
};

/** Ondalık sayı parse — virgül veya nokta ayırıcı kabul eder */
const parseDecimal = (v: string): number => parseFloat(v.replace(",", ".")) || 0;

// Parse user-typed date to ISO-like string the API accepts.
// Accepts: "DD.MM.YYYY HH:MM", "YYYY-MM-DD HH:MM", "YYYY-MM-DDTHH:MM"
const parseDisplayDt = (val: string): string => {
  if (!val.trim()) return "";
  // Already in ISO-T format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return val;
  // Space-separated ISO: YYYY-MM-DD HH:MM → add T
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(val)) return val.replace(" ", "T");
  // Turkish: DD.MM.YYYY HH:MM
  const m = val.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
  return val;
};

function UserEditOrderModal({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const [openPrice, setOpenPrice] = useState(String(order.openPrice ?? ""));
  const [closePrice, setClosePrice] = useState(String(order.closePrice ?? ""));
  const [lots, setLots] = useState(String(order.lots));
  const [direction, setDirection] = useState(order.direction || "buy");
  const [openedAt, setOpenedAt] = useState(toDisplayDt(order.filledAt || order.createdAt));
  const [closedAt, setClosedAt] = useState(toDisplayDt(order.closedAt));
  const [profitLossVal, setProfitLossVal] = useState(String(order.profitLoss ?? ""));
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const isClosed = order.status === "closed";

  const handleResetToMarket = async () => {
    if (!confirm(`${order.symbol} için açılış fiyatını ANLIKAN BIST fiyatına sıfırlamak istediğinize emin misiniz?`)) return;
    setResetLoading(true); setError(""); setResetMsg("");
    try {
      const res = await apiFetch(`/admin/orders/${order.id}/reset-to-market`, { method: "POST" });
      setOpenPrice(String(res.newOpenPrice?.toFixed(2) ?? ""));
      setResetMsg(`✓ Açılış fiyatı ${res.newOpenPrice?.toFixed(2)} TL olarak güncellendi`);
    } catch (e: unknown) { setError(String(e)); }
    setResetLoading(false);
  };

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      const body: Record<string, unknown> = {
        direction,
        lots: Number(lots),
        openPrice: openPrice ? parseDecimal(openPrice) : undefined,
        openedAt: openedAt ? parseDisplayDt(openedAt) : undefined,
      };
      if (isClosed) {
        body.closePrice = closePrice ? parseDecimal(closePrice) : undefined;
        body.closedAt = closedAt ? parseDisplayDt(closedAt) : undefined;
        body.profitLoss = profitLossVal !== "" ? parseDecimal(profitLossVal) : undefined;
      }
      await apiFetch(`/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSuccess();
    } catch (e: unknown) { setError(String(e)); }
    setLoading(false);
  };

  const inputCls = "mt-1 w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-2 rounded outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="font-bold text-foreground">İşlem Düzenle</p>
            <p className="text-xs text-muted-foreground">#{order.id} — {order.symbol}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {/* İşlem Bilgileri özet bloğu */}
        <div className="mx-4 mt-4 rounded-lg bg-secondary/40 border border-border text-xs divide-y divide-border">
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-muted-foreground font-medium">Açılış Seviyesi</span>
            <span className="text-foreground font-bold">{order.openPrice != null ? order.openPrice.toFixed(2) : "—"}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2">
            <span className="text-muted-foreground font-medium">Açılış Zamanı</span>
            <span className="text-foreground">{order.filledAt || order.createdAt ? new Date(order.filledAt || order.createdAt!).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          </div>
          {isClosed && (
            <>
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-muted-foreground font-medium">Kapanış Seviyesi</span>
                <span className="text-foreground font-bold">{order.closePrice != null ? order.closePrice.toFixed(2) : "—"}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-muted-foreground font-medium">Kapanış Zamanı</span>
                <span className="text-foreground">{order.closedAt ? new Date(order.closedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              </div>
            </>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className={labelCls}>Yön</p>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setDirection("buy")} className={`flex-1 py-2 text-sm font-bold transition-colors ${direction === "buy" ? "bg-green-700 text-foreground" : "bg-secondary/50 text-muted-foreground"}`}>ALIŞ</button>
              <button onClick={() => setDirection("sell")} className={`flex-1 py-2 text-sm font-bold transition-colors ${direction === "sell" ? "bg-red-700 text-foreground" : "bg-secondary/50 text-muted-foreground"}`}>SATIŞ</button>
            </div>
          </div>
          <div><label className={labelCls}>Adet (Lot)</label><input type="number" min="1" step="1" value={lots} onChange={e => setLots(e.target.value)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Açılış Fiyatı</label>
            <input type="text" inputMode="decimal" value={openPrice} onChange={e => setOpenPrice(e.target.value)} className={inputCls} placeholder="ör: 12,50" />
            {!isClosed && (
              <button
                onClick={handleResetToMarket}
                disabled={resetLoading}
                className="mt-2 w-full py-1.5 rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                {resetLoading ? "Fiyat alınıyor..." : "⟳ Anlık BIST Fiyatına Sıfırla"}
              </button>
            )}
            {resetMsg && <p className="mt-1 text-xs text-green-400">{resetMsg}</p>}
          </div>
          <div>
            <label className={labelCls}>Açılış Tarihi</label>
            <input
              type="text"
              placeholder="YYYY-AA-GG SS:DD  veya  GG.AA.YYYY SS:DD"
              value={openedAt}
              onChange={e => setOpenedAt(e.target.value)}
              className={inputCls}
            />
          </div>
          {isClosed && (
            <>
              <div><label className={labelCls}>Kapanış Fiyatı</label><input type="text" inputMode="decimal" value={closePrice} onChange={e => setClosePrice(e.target.value)} className={inputCls} placeholder="ör: 12,50" /></div>
              <div>
                <label className={labelCls}>Kapanış Tarihi</label>
                <input
                  type="text"
                  placeholder="YYYY-AA-GG SS:DD  veya  GG.AA.YYYY SS:DD"
                  value={closedAt}
                  onChange={e => setClosedAt(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div><label className={labelCls}>Kar / Zarar (K/Z)</label><input type="text" inputMode="decimal" value={profitLossVal} onChange={e => setProfitLossVal(e.target.value)} className={inputCls} placeholder="ör: -250,00" /></div>
            </>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-foreground/80 text-sm hover:bg-accent">İptal</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerEditModal({
  userId,
  ledger,
  onClose,
  onSuccess,
}: {
  userId: number;
  ledger: BalanceTransaction | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isNew = !ledger;
  const nowLocal = toLocalDt(new Date().toISOString());
  const [type, setType] = useState(ledger?.type || "deposit");
  const [amount, setAmount] = useState(String(ledger?.amount ?? ""));
  const [description, setDescription] = useState(ledger?.description || "");
  const [balanceBefore, setBalanceBefore] = useState(String(ledger?.balanceBefore ?? ""));
  const [balanceAfter, setBalanceAfter] = useState(String(ledger?.balanceAfter ?? ""));
  const [createdAt, setCreatedAt] = useState(toDisplayDt(ledger?.createdAt || nowLocal));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!amount) { setError("Tutar giriniz"); return; }
    setLoading(true); setError("");
    try {
      const body = {
        type, amount: parseDecimal(amount),
        description: description || null,
        balanceBefore: balanceBefore !== "" ? parseDecimal(balanceBefore) : 0,
        balanceAfter: balanceAfter !== "" ? parseDecimal(balanceAfter) : 0,
        createdAt: createdAt ? parseDisplayDt(createdAt) : undefined,
      };
      if (isNew) {
        await apiFetch(`/admin/users/${userId}/balance-transactions`, { method: "POST", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/admin/balance-transactions/${ledger!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSuccess();
    } catch (e: unknown) { setError(String(e)); }
    setLoading(false);
  };

  const inp = "mt-1 w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-2 rounded outline-none focus:border-primary";
  const lbl = "text-xs font-medium text-muted-foreground";
  const typeLabel: Record<string, string> = {
    deposit: "YATIRIM", withdraw: "ÇEKİM", admin_adjustment: "ADMİN DÜZELTME",
    trade_open: "İŞLEM AÇILIŞ", trade_close: "İŞLEM KAPANIŞ",
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="font-bold text-foreground">{isNew ? "Yeni Kayıt Ekle" : "Kaydı Düzenle"}</p>
            {!isNew && <p className="text-xs text-muted-foreground">#{ledger!.id}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <p className={lbl}>Tür</p>
            <select value={type} onChange={e => setType(e.target.value)} className={inp}>
              {Object.entries(typeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tutar (₺) — eksi tutar için başına - ekle</label>
            <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={inp} placeholder="örn: 50000 ya da -10000" />
          </div>
          <div>
            <label className={lbl}>Açıklama</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inp} placeholder="isteğe bağlı" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Önceki Bakiye</label>
              <input type="text" inputMode="decimal" value={balanceBefore} onChange={e => setBalanceBefore(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Sonraki Bakiye</label>
              <input type="text" inputMode="decimal" value={balanceAfter} onChange={e => setBalanceAfter(e.target.value)} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Tarih / Saat</label>
            <input
              type="text"
              placeholder="YYYY-AA-GG SS:DD  veya  GG.AA.YYYY SS:DD"
              value={createdAt}
              onChange={e => setCreatedAt(e.target.value)}
              className={inp}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border text-foreground/80 text-sm hover:bg-accent">İptal</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchableHeader({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <th className="px-2 py-1 text-xs font-semibold text-foreground/80 border-b border-border whitespace-nowrap min-w-[80px]">
      <div className="flex items-center gap-1 mb-1">
        <span>{label}</span>
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ara..."
        className="w-full bg-secondary/50 border border-border text-white text-[10px] px-1 py-0.5 rounded outline-none focus:border-primary placeholder:text-gray-600"
      />
    </th>
  );
}

function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading, refetch } = useAdminGetUser(userId, { query: { refetchInterval: 3_000 } });
  const { mutate: updateBalance } = useAdminUpdateBalance();
  const { mutate: updateUser } = useAdminUpdateUser();
  const { mutate: verifyIdentity } = useAdminVerifyIdentity();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: adminUser } = useAdminAuth();
  const [tab, setTab] = useState<TabType>("open");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [balanceForm, setBalanceForm] = useState({ amount: "", type: "add", note: "" });
  const [userForm, setUserForm] = useState<Partial<AdminUpdateUserRequest> | null>(null);
  const [showUserEdit, setShowUserEdit] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "", tcNo: "", birthDate: "", city: "", district: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editingCell, setEditingCell] = useState<{ orderId: number; field: string; value: string } | null>(null);
  const [ledgerModal, setLedgerModal] = useState<{ record: BalanceTransaction | null } | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; title: string } | null>(null);
  const [metalSubAccountId, setMetalSubAccountId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [deletingUser, setDeletingUser] = useState(false);
  const [ibTransferOpen, setIbTransferOpen] = useState(false);
  const [ibList, setIbList] = useState<any[]>([]);
  const [ibTransferring, setIbTransferring] = useState(false);
  const [ibPromoting, setIbPromoting] = useState(false);
  const [showOpenOrder, setShowOpenOrder] = useState(false);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [ibPromoteFormOpen, setIbPromoteFormOpen] = useState(false);
  const [ibReferralCodeInput, setIbReferralCodeInput] = useState("");

  // Live P&L: poll every 2 seconds for real-time profit display
  const [livePnlMap, setLivePnlMap] = useState<Record<number, { currentPrice: number; profitLoss: number | null; hasLivePrice: boolean }>>({});
  useEffect(() => {
    const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
    const poll = () => {
      fetch(`/api/admin/users/${userId}/live-pnl`, {
        headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
        cache: "no-store",
      })
        .then(r => r.ok ? r.json() : null)
        .then((rows: Array<{ id: number; currentPrice: number; profitLoss: number | null; hasLivePrice: boolean }> | null) => {
          if (!rows) return;
          const map: typeof livePnlMap = {};
          rows.forEach(r => { map[r.id] = { currentPrice: r.currentPrice, profitLoss: r.profitLoss, hasLivePrice: r.hasLivePrice }; });
          setLivePnlMap(map);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [userId]);

  const handlePromoteToIB = async () => {
    const code = ibReferralCodeInput.trim().toUpperCase();
    if (!code) { toast({ title: "Referans kodu giriniz", variant: "destructive" }); return; }
    setIbPromoting(true);
    try {
      const result = await apiFetch(`/admin/users/${userId}/promote-ib`, {
        method: "PATCH",
        body: JSON.stringify({ ibReferralCode: code }),
      });
      toast({ title: "IB Atandı", description: result.message });
      setIbPromoteFormOpen(false);
      setIbReferralCodeInput("");
      refetch();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setIbPromoting(false);
    }
  };

  const loadIBList = () => {
    apiFetch("/admin/ib")
      .then((d: any) => setIbList(d.ibUsers || []))
      .catch(() => {});
  };

  const handleAssignIB = async (ibId: number | null) => {
    setIbTransferring(true);
    try {
      const result = await apiFetch(`/admin/users/${userId}/assign-ib`, {
        method: "PATCH",
        body: JSON.stringify({ ibId }),
      });
      toast({ title: "IB Transferi", description: result.message });
      setIbTransferOpen(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setIbTransferring(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm(`"${data?.user?.firstName} ${data?.user?.lastName}" hesabını kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz. Tüm işlem geçmişi, emirler ve veriler silinecektir.`)) return;
    setDeletingUser(true);
    try {
      await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
      toast({ title: "Hesap silindi", description: "Kullanıcı hesabı kalıcı olarak silindi" });
      queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      onClose();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setDeletingUser(false);
    }
  };

  // Update `now` every 15s so online/offline badge stays accurate without waiting for refetch
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const setFilter = (col: string, val: string) => setColFilters(prev => ({ ...prev, [col]: val }));
  const getFilter = (col: string) => colFilters[col] || "";

  const openImageModal = (fileUrl: string, title: string) => {
    const token = localStorage.getItem("admin_auth_token");
    const apiUrl = `/api/admin/identity-image?path=${encodeURIComponent(fileUrl)}`;
    fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const imageBlob = blob.type.startsWith("image/") ? blob : new Blob([blob], { type: "image/jpeg" });
        const url = URL.createObjectURL(imageBlob);
        setImageModal({ url, title });
      })
      .catch(err => console.error("Görsel yüklenemedi:", err));
  };

  const user: User | undefined = data?.user;
  const parentIb: { id: number; firstName: string; lastName: string; accountId: string; ibReferralCode: string | null } | null = (data as any)?.parentIb || null;
  const orders: Order[] = data?.orders || [];
  const balanceHistory: BalanceTransaction[] = data?.balanceHistory || [];
  const metalSubAccounts: Array<{ id: number; accountId: string; subAccountName: string | null; balance: number; balanceCurrency: string; leverage: number | null; createdAt: string }> = (data as any)?.metalSubAccounts || [];

  const openOrders = orders.filter(o => o.status === "open");
  const pendingOrders = orders.filter(o => o.status === "pending");
  const closedOrders = orders.filter(o => o.status === "closed");
  const visibleBalanceHistory = balanceHistory.filter(t => t.type !== "trade_open");

  // Merge live P&L data into open orders for real-time display
  const openOrdersLive: Order[] = openOrders.map(o => {
    const live = livePnlMap[o.id];
    if (!live) return o;
    return { ...o, profitLoss: live.profitLoss ?? o.profitLoss, currentPrice: live.currentPrice };
  });

  const totalProfit = openOrdersLive.reduce((s, o) => s + (o.profitLoss || 0), 0);
  const totalMargin = openOrdersLive.reduce((s, o) => s + ((o.openPrice || 0) * o.lots), 0);
  // Portföy piyasa değeri = canlı fiyat × lot (canlı fiyat yoksa açılış fiyatı)
  const portfolioValue = openOrdersLive.reduce((s, o) => s + ((o.currentPrice || o.openPrice || 0) * o.lots), 0);
  // Varlık (Equity) = nakit + portföy piyasa değeri (totalProfit yanlış — balance'dan zaten maliyet düşülmüş)
  const equity = (user?.balance || 0) + portfolioValue;
  const freeMargin = equity - totalMargin;
  const marginLevel = totalMargin > 0 ? (equity / totalMargin) * 100 : 0;
  const allSwap = openOrdersLive.reduce((s, o) => s + (o.spreadAdjustment || 0), 0);
  const allCommission = openOrdersLive.reduce((s, o) => s + (o.commissionAmount || 0), 0);
  const totalTotalProfit = openOrdersLive.reduce((s, o) => s + (o.profitLoss || 0) + (o.spreadAdjustment || 0) + (o.commissionAmount || 0), 0);

  const filterOrders = (list: Order[]) =>
    list.filter(o => {
      for (const [col, val] of Object.entries(colFilters)) {
        if (!val) continue;
        const v = val.toLowerCase();
        const field = (o as unknown as Record<string, unknown>)[col];
        if (field === undefined || field === null) continue;
        if (!String(field).toLowerCase().includes(v)) return false;
      }
      return true;
    });

  const handleBalanceSave = () => {
    const amount = parseFloat(balanceForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Hatalı tutar", variant: "destructive" });
      return;
    }
    updateBalance({ id: userId, data: { amount, type: balanceForm.type as "add" | "subtract" | "set", note: balanceForm.note } }, {
      onSuccess: () => {
        toast({ title: "Bakiye güncellendi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAdminGetStatsQueryKey() });
        setBalanceForm({ amount: "", type: "add", note: "" });
        refetch();
      },
      onError: () => {
        toast({ title: "Bakiye güncellenemedi", variant: "destructive" });
      }
    });
  };

  const handleUserSave = () => {
    if (!userForm) return;
    updateUser({ id: userId, data: userForm as AdminUpdateUserRequest }, {
      onSuccess: () => {
        toast({ title: "Kullanıcı güncellendi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        setShowUserEdit(false);
        refetch();
      },
      onError: () => {
        toast({ title: "Kullanıcı güncellenemedi", variant: "destructive" });
      }
    });
  };

  const handleProfileSave = () => {
    setProfileSaving(true);
    updateUser({ id: userId, data: profileForm as AdminUpdateUserRequest }, {
      onSuccess: () => {
        toast({ title: "Kişisel bilgiler güncellendi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
        setShowProfileEdit(false);
        refetch();
        setProfileSaving(false);
      },
      onError: (e: any) => {
        toast({ title: "Güncellenemedi", description: String(e), variant: "destructive" });
        setProfileSaving(false);
      }
    });
  };

  const handlePasswordReset = async () => {
    if (!newPw || newPw.length < 6) {
      toast({ title: "Şifre en az 6 karakter olmalı", variant: "destructive" }); return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Şifreler eşleşmiyor", variant: "destructive" }); return;
    }
    setPwSaving(true);
    try {
      await apiFetch(`/admin/users/${userId}/password`, { method: "PATCH", body: JSON.stringify({ newPassword: newPw }) });
      toast({ title: "Şifre güncellendi", description: "Kullanıcı yeni şifresiyle giriş yapabilir." });
      setNewPw(""); setConfirmPw("");
    } catch (e: unknown) {
      toast({ title: "Hata", description: String(e), variant: "destructive" });
    }
    setPwSaving(false);
  };

  const handleReopenOrder = async (order: Order) => {
    if (!confirm(`#${order.id} numaralı işlemi yeniden açmak istediğinizden emin misiniz?\nKullanıcının bakiyesi kapanış tutarı kadar azaltılacak.`)) return;
    try {
      await apiFetch(`/admin/orders/${order.id}/reopen`, { method: "POST" });
      toast({ title: "İşlem yeniden açıldı" });
      refetch();
    } catch (e: unknown) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleCancelOrder = async () => {
    if (!confirmCancelOrder) return;
    setCancellingOrder(true);
    try {
      await apiFetch(`/admin/orders/${confirmCancelOrder.id}/cancel`, { method: "POST" });
      toast({ title: "İşlem iptal edildi", description: `#${confirmCancelOrder.id} numaralı işlem iptal edildi, bakiye tam olarak iade edildi.` });
      setConfirmCancelOrder(null);
      refetch();
    } catch (e: unknown) {
      toast({ title: "Hata", description: String(e), variant: "destructive" });
    }
    setCancellingOrder(false);
  };

  const inlineSave = async (orderId: number, field: string, value: string) => {
    setEditingCell(null);
    const body: Record<string, unknown> = {};
    if (field === "lots") body.lots = Number(value);
    else if (field === "openPrice") body.openPrice = parseDecimal(value);
    else if (field === "openedAt") body.openedAt = parseDisplayDt(value);
    else if (field === "direction") body.direction = value;
    else if (field === "closePrice") body.closePrice = parseDecimal(value);
    else if (field === "closedAt") body.closedAt = parseDisplayDt(value);
    else if (field === "profitLoss") body.profitLoss = parseDecimal(value);
    try {
      await apiFetch(`/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify(body) });
      refetch();
    } catch (e: unknown) {
      toast({ title: "Güncelleme hatası", description: String(e), variant: "destructive" });
    }
  };

  const handleVerify = (approved: boolean) => {
    verifyIdentity({ userId, data: { approved } }, {
      onSuccess: () => {
        toast({ title: approved ? "Kimlik onaylandı" : "Kimlik reddedildi" });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      }
    });
  };

  const fmt = (n: number | null | undefined) => (n ?? 0).toFixed(2);
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  const PositionsTable = ({ list, showReopen }: { list: Order[]; showReopen?: boolean }) => {
    const filtered = filterOrders(list);
    return (
      <div className="text-xs">
        <div className="flex gap-4 p-2 border-b border-border text-muted-foreground text-[11px]">
          <span>Swap: <strong className="text-foreground">{fmt(allSwap)}</strong></span>
          <span>Komisyon: <strong className="text-foreground">{fmt(allCommission)}</strong></span>
          <span>Profit: <strong className="text-foreground">{fmt(totalProfit)}</strong></span>
          <span>Toplam Profit: <strong className="text-foreground">{fmt(totalTotalProfit)}</strong></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-card">
                <SearchableHeader label="No" value={getFilter("id")} onChange={v => setFilter("id", v)} />
                <SearchableHeader label="Sembol" value={getFilter("symbol")} onChange={v => setFilter("symbol", v)} />
                <SearchableHeader label="Tarih" value={getFilter("filledAt")} onChange={v => setFilter("filledAt", v)} />
                <SearchableHeader label="Lot" value={getFilter("lots")} onChange={v => setFilter("lots", v)} />
                <SearchableHeader label="Yön" value={getFilter("direction")} onChange={v => setFilter("direction", v)} />
                <SearchableHeader label="Açılış" value={getFilter("openPrice")} onChange={v => setFilter("openPrice", v)} />
                <SearchableHeader label="Fiyat" value={getFilter("currentPrice")} onChange={v => setFilter("currentPrice", v)} />
                <SearchableHeader label="Toplam" value={getFilter("totalAmount")} onChange={v => setFilter("totalAmount", v)} />
                <SearchableHeader label="Swap" value={getFilter("spreadAdjustment")} onChange={v => setFilter("spreadAdjustment", v)} />
                <SearchableHeader label="Komisyon" value={getFilter("commissionAmount")} onChange={v => setFilter("commissionAmount", v)} />
                <SearchableHeader label="Profit" value={getFilter("profitLoss")} onChange={v => setFilter("profitLoss", v)} />
                <th className="px-2 py-1 text-xs font-semibold text-foreground/80 border-b border-border whitespace-nowrap min-w-[60px]">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center text-muted-foreground py-8">Kayıt bulunamadı</td></tr>
              ) : filtered.map((o) => {
                const profit = o.profitLoss || 0;
                const isEditing = (field: string) => editingCell?.orderId === o.id && editingCell?.field === field;
                const editVal = editingCell?.value ?? "";
                const startEdit = (field: string, value: string) => setEditingCell({ orderId: o.id, field, value });
                const decimalFields = ["openPrice", "closePrice", "profitLoss"];
                const cellInput = (field: string, type: string, extraCls = "") => (
                  <input
                    type={decimalFields.includes(field) ? "text" : type}
                    inputMode={decimalFields.includes(field) ? "decimal" : undefined}
                    value={editVal}
                    autoFocus
                    className={`bg-background border border-primary rounded px-1 py-0.5 text-xs focus:outline-none ${extraCls}`}
                    onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                    onKeyDown={e => {
                      if (e.key === "Enter") inlineSave(o.id, field, editVal);
                      if (e.key === "Escape") setEditingCell(null);
                    }}
                    onBlur={() => inlineSave(o.id, field, editVal)}
                  />
                );
                return (
                  <tr key={o.id} className="border-b border-border hover:bg-accent/30 transition-colors group">
                    <td className="px-2 py-1.5 font-mono text-foreground">{o.id}</td>
                    <td className="px-2 py-1.5 font-bold text-blue-300">{o.symbol}</td>

                    {/* Tarih — double-click to edit */}
                    <td
                      className="px-2 py-1.5 text-muted-foreground whitespace-nowrap cursor-pointer select-none"
                      onDoubleClick={() => startEdit("openedAt", toDisplayDt(o.filledAt || o.createdAt))}
                      title="Çift tıkla düzenle"
                    >
                      {isEditing("openedAt") ? cellInput("openedAt", "text", "w-36") : fmtDate(o.filledAt || o.createdAt)}
                    </td>

                    {/* Lot — double-click to edit */}
                    <td
                      className="px-2 py-1.5 text-foreground cursor-pointer select-none"
                      onDoubleClick={() => startEdit("lots", String(o.lots))}
                      title="Çift tıkla düzenle"
                    >
                      {isEditing("lots") ? cellInput("lots", "number", "w-16") : o.lots}
                    </td>

                    {/* Yön — double-click to toggle */}
                    <td
                      className={`px-2 py-1.5 font-bold uppercase cursor-pointer select-none ${o.direction === "buy" ? "text-green-400" : "text-red-400"}`}
                      onDoubleClick={() => inlineSave(o.id, "direction", o.direction === "buy" ? "sell" : "buy")}
                      title="Çift tıkla değiştir"
                    >
                      {o.direction === "buy" ? "AL" : "SAT"}
                    </td>

                    {/* Açılış Fiyatı — double-click to edit */}
                    <td
                      className="px-2 py-1.5 text-foreground cursor-pointer select-none"
                      onDoubleClick={() => startEdit("openPrice", String(o.openPrice ?? ""))}
                      title="Çift tıkla düzenle"
                    >
                      {isEditing("openPrice") ? cellInput("openPrice", "number", "w-20") : fmt(o.openPrice)}
                    </td>

                    {/* Güncel Fiyat / Kapanış Fiyatı — double-click to edit if closed */}
                    <td
                      className="px-2 py-1.5 text-foreground cursor-pointer select-none"
                      onDoubleClick={() => o.status === "closed" ? startEdit("closePrice", String(o.closePrice ?? "")) : undefined}
                      title={o.status === "closed" ? "Çift tıkla düzenle" : ""}
                    >
                      {isEditing("closePrice") ? cellInput("closePrice", "number", "w-20") : (
                        <span className="flex items-center gap-1">
                          {o.status === "open" && (o as any).hasLivePrice && (
                            <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse flex-shrink-0" title="Canlı fiyat" />
                          )}
                          {o.status === "open" ? fmt((o as any).currentPrice ?? o.openPrice) : fmt(o.closePrice ?? o.openPrice)}
                        </span>
                      )}
                    </td>

                    <td className="px-2 py-1.5 text-foreground tabular-nums">{fmt(o.totalAmount)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{fmt(o.spreadAdjustment)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{fmt(o.commissionAmount)}</td>

                    {/* Profit — double-click to edit if closed */}
                    <td
                      className={`px-2 py-1.5 font-bold tabular-nums cursor-pointer select-none ${o.profitLoss == null ? "text-muted-foreground" : profit >= 0 ? "text-green-400" : "text-red-400"}`}
                      onDoubleClick={() => o.status === "closed" ? startEdit("profitLoss", String(o.profitLoss ?? "")) : undefined}
                      title={o.status === "closed" ? "Çift tıkla düzenle" : ""}
                    >
                      {isEditing("profitLoss") ? cellInput("profitLoss", "number", "w-20") : (o.profitLoss != null ? fmt(profit) : "—")}
                    </td>

                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setEditOrder(o)}
                          title="Düzenle"
                          className="p-1 rounded hover:bg-blue-900/30 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {o.status === "open" && (
                          <button
                            onClick={() => setConfirmCancelOrder(o)}
                            title="İşlemi İptal Et (Tam İade)"
                            className="p-1 rounded hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {showReopen && (
                          <button
                            onClick={() => handleReopenOrder(o)}
                            title="Geri Getir"
                            className="p-1 rounded hover:bg-amber-900/30 text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleDeleteLedger = async (id: number) => {
    if (!confirm("Bu kaydı silmek istediğinizden emin misiniz?")) return;
    try {
      await apiFetch(`/admin/balance-transactions/${id}`, { method: "DELETE" });
      toast({ title: "Kayıt silindi" });
      refetch();
    } catch (e: unknown) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const LedgersTable = () => {
    const visibleLedgers = visibleBalanceHistory;
    return (
    <div className="overflow-x-auto text-xs">
      <div className="flex justify-between items-center px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-muted-foreground">{visibleLedgers.length} kayıt</span>
        <button
          onClick={() => setLedgerModal({ record: null })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-lg text-white text-xs font-bold hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Yeni Kayıt Ekle
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-card border-b border-border">
            {["No", "Tarih", "Tür", "Açıklama", "Tutar", "Önceki", "Sonraki", ""].map(h => (
              <th key={h} className="px-3 py-2 text-left text-foreground/80 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleLedgers.length === 0 ? (
            <tr><td colSpan={8} className="text-center text-muted-foreground py-8">İşlem bulunamadı</td></tr>
          ) : visibleLedgers.map((t, i) => (
            <tr key={t.id ?? i} className="border-b border-border hover:bg-accent/50">
              <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</td>
              <td className="px-3 py-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  t.type === "deposit" ? "bg-green-100 text-green-700" :
                  t.type === "withdraw" || t.type === "withdrawal" ? "bg-red-100 text-red-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {t.type === "deposit" ? "YATIRIM" :
                   t.type === "withdraw" || t.type === "withdrawal" ? "ÇEKİM" :
                   t.type === "trade_open" ? "AÇILIŞ" :
                   t.type === "trade_close" ? "KAPANIŞ" : "ADMİN"}
                </span>
              </td>
              <td className="px-3 py-1.5 text-foreground/80 max-w-[140px] truncate">{t.description || "-"}</td>
              <td className={`px-3 py-1.5 font-bold ${(t.amount ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(t.amount)} ₺</td>
              <td className="px-3 py-1.5 text-muted-foreground">{fmt(t.balanceBefore)} ₺</td>
              <td className="px-3 py-1.5 text-muted-foreground">{fmt(t.balanceAfter)} ₺</td>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLedgerModal({ record: t })}
                    title="Düzenle"
                    className="p-1 rounded hover:bg-accent text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteLedger(t.id)}
                    title="Sil"
                    className="p-1 rounded hover:bg-destructive/10 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  };

  if (isLoading) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-background shadow-2xl flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-background shadow-2xl flex flex-col overflow-hidden">
      {imageModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center"
          onClick={() => { URL.revokeObjectURL(imageModal.url); setImageModal(null); }}
        >
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-secondary/50 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
            {imageModal.title}
          </div>
          <img
            src={imageModal.url}
            alt={imageModal.title}
            className="max-w-[92vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 bg-secondary/50 hover:bg-muted rounded-full text-foreground p-2 transition-colors"
            onClick={() => { URL.revokeObjectURL(imageModal.url); setImageModal(null); }}
          >
            <X className="w-5 h-5" />
          </button>
          <p className="absolute bottom-4 text-xs text-muted-foreground">Kapatmak için herhangi bir yere tıklayın</p>
        </div>
      )}
      <div className="bg-card border-b border-border flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base flex-shrink-0">
              {user?.firstName?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-foreground truncate">{user?.firstName} {user?.lastName}</span>
                {(() => {
                  const lastSeen = user?.lastSeenAt ? new Date(user.lastSeenAt) : null;
                  const diffMs = lastSeen ? now - lastSeen.getTime() : null;
                  const isOnline = diffMs !== null && diffMs < 2 * 60 * 1000;
                  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />;
                })()}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-bold text-primary">#{user?.accountId}</span>
                <span>·</span>
                <span>{user?.phone}</span>
                {user?.tcNo && <><span>·</span><span>TC: {user.tcNo}</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(() => {
              const lastSeen = user?.lastSeenAt ? new Date(user.lastSeenAt) : null;
              const diffMs = lastSeen ? now - lastSeen.getTime() : null;
              const fmtLastSeen = () => {
                if (!diffMs) return "Giriş yok";
                if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)} sn önce`;
                if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)} dk önce`;
                if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)} sa önce`;
                return lastSeen!.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
              };
              return <span className="text-xs text-muted-foreground hidden sm:inline">{fmtLastSeen()}</span>;
            })()}
            <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
            {adminUser?.isSuper && (
              <button onClick={handleDeleteUser} disabled={deletingUser} title="Hesabı Sil"
                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-stretch border-t border-border overflow-x-auto">
          {/* Bakiye = nakit + açık pozisyon piyasa değeri (toplam varlık) */}
          <div className="flex flex-col border-r border-border px-4 py-2 min-w-[110px]">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Bakiye</span>
            <span className="text-sm font-bold text-foreground">{fmtCurrency(equity)}</span>
          </div>
          {/* T+2 = açık pozisyon piyasa değeri (kilitli) */}
          <div className="flex flex-col border-r border-border px-4 py-2 min-w-[110px] bg-amber-500/5">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider mb-0.5">T+2 (Kilitli)</span>
            <span className="text-sm font-bold text-amber-900 dark:text-amber-100">{fmtCurrency(portfolioValue)}</span>
            {portfolioValue > 0 && <span className="text-[9px] text-amber-600/70 mt-0.5">Açık poz. piyasa değeri</span>}
          </div>
          {/* Kullanılabilir = nakit + net K/Z */}
          <div className="flex flex-col border-r border-border px-4 py-2 min-w-[110px]">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Kullanılabilir</span>
            <span className="text-sm font-bold text-foreground">{fmtCurrency((user?.balance || 0) + totalProfit)}</span>
          </div>
          {/* K/Z = açık pozisyonların net kar/zarar */}
          <div className={`flex flex-col border-r border-border last:border-r-0 px-4 py-2 min-w-[110px] ${totalProfit >= 0 ? "bg-green-500/5" : "bg-red-500/5"}`}>
            <span className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${totalProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>K/Z</span>
            <span className={`text-sm font-bold ${totalProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {totalProfit >= 0 ? "+" : ""}{fmtCurrency(totalProfit)}
            </span>
            {totalMargin > 0 && (
              <span className={`text-[9px] mt-0.5 ${totalProfit >= 0 ? "text-green-600/70" : "text-red-500/70"}`}>
                {totalMargin > 0 ? `${((totalProfit / totalMargin) * 100).toFixed(2)}%` : ""}
              </span>
            )}
          </div>
          {/* Nakit (ham bakiye) — yönetim için */}
          <div className="flex flex-col border-r border-border last:border-r-0 px-4 py-2 min-w-[110px]">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">Nakit</span>
            <span className="text-sm font-bold text-foreground">{fmtCurrency(user?.balance || 0)}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-muted/50 flex-shrink-0">
        <div className="flex items-center text-sm px-2">
          <div className="flex flex-1 overflow-x-auto">
            {([
              ["account", "Hesap Bilgileri"],
              ["open", `Açık Pozisyonlar (${openOrdersLive.length})`],
              ["orders", `Emirler (${pendingOrders.length})`],
              ["closed", `Kapalı (${closedOrders.length})`],
              ["ledgers", `İşlem Geçmişi (${visibleBalanceHistory.length})`],
              ...(metalSubAccounts.length > 0 ? [["metal", `Emtia Hesabı (${metalSubAccounts.length})`] as [TabType, string]] : []),
            ] as [TabType, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowOpenOrder(true)}
            className="flex items-center gap-1.5 ml-2 mr-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> İşlem Aç
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background">
        {tab === "account" && (
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Hesap Bilgileri</h3>
                  {!showProfileEdit && (
                    <button
                      onClick={() => {
                        setProfileForm({
                          firstName: user?.firstName || "",
                          lastName: user?.lastName || "",
                          phone: user?.phone || "",
                          tcNo: user?.tcNo || "",
                          birthDate: user?.birthDate || "",
                          city: user?.city || "",
                          district: user?.district || "",
                        });
                        setShowProfileEdit(true);
                      }}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      <Pencil className="w-3 h-3" /> Düzenle
                    </button>
                  )}
                </div>

                {!showProfileEdit ? (
                  <>
                    {[
                      ["Hesap No", `#${user?.accountId}`],
                      ["Ad Soyad", `${user?.firstName} ${user?.lastName}`],
                      ["Telefon", user?.phone],
                      ["TC Kimlik", user?.tcNo],
                      ["Doğum Tarihi", user?.birthDate],
                      ["Şehir / İlçe", user?.city || user?.district ? `${user?.city || ""}${user?.district ? ` / ${user?.district}` : ""}` : "-"],
                      ["Hesap Türü", user?.accountType?.toUpperCase()],
                      ["Kimlik Durumu", user?.identityStatus],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-foreground font-medium">{value || "-"}</span>
                      </div>
                    ))}
                    <div className="border-t border-border/50 pt-2 mt-1 space-y-1.5">
                      {[
                        ["Bakiye", fmtCurrency(equity), ""],
                        ["T+2 (Kilitli)", fmtCurrency(portfolioValue), "text-amber-600 dark:text-amber-400"],
                        ["Kullanılabilir", fmtCurrency((user?.balance || 0) + totalProfit), ""],
                        ["K/Z", (totalProfit >= 0 ? "+" : "") + fmtCurrency(totalProfit), totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"],
                        ["Nakit", fmtCurrency(user?.balance || 0), ""],
                        ["Dondurulmuş", fmtCurrency(user?.frozenBalance || 0), ""],
                      ].map(([label, value, cls]) => (
                        <div key={label as string} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-medium ${cls || "text-foreground"}`}>{value || "-"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Referans IB</span>
                      {parentIb ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="font-medium text-foreground">{parentIb.firstName} {parentIb.lastName}</span>
                          <span className="font-mono text-xs text-muted-foreground">#{parentIb.accountId}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Ad</label>
                        <input
                          className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                          value={profileForm.firstName}
                          onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                          placeholder="Ad"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Soyad</label>
                        <input
                          className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                          value={profileForm.lastName}
                          onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                          placeholder="Soyad"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Telefon</label>
                      <input
                        className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                        value={profileForm.phone}
                        onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="5xxxxxxxxx"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">TC Kimlik No</label>
                      <input
                        className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary font-mono tracking-widest"
                        value={profileForm.tcNo}
                        onChange={e => setProfileForm(f => ({ ...f, tcNo: e.target.value }))}
                        placeholder="11 hane"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Doğum Tarihi</label>
                      <input
                        type="date"
                        className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                        value={profileForm.birthDate}
                        onChange={e => setProfileForm(f => ({ ...f, birthDate: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Şehir</label>
                        <input
                          className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                          value={profileForm.city}
                          onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                          placeholder="İstanbul"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">İlçe</label>
                        <input
                          className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                          value={profileForm.district}
                          onChange={e => setProfileForm(f => ({ ...f, district: e.target.value }))}
                          placeholder="Kadıköy"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 bg-primary hover:bg-primary/80" onClick={handleProfileSave} disabled={profileSaving}>
                        {profileSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Kaydet
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-border text-foreground/80" onClick={() => setShowProfileEdit(false)}>
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-card rounded-lg p-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2 mb-3">Kimlik Doğrulama</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      user?.identityStatus === "approved" ? "bg-green-100 text-green-700" :
                      user?.identityStatus === "pending" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {user?.identityStatus === "approved" ? "Onaylı" : user?.identityStatus === "pending" ? "Beklemede" : "Onaysız"}
                    </span>
                  </div>
                  {user?.identityStatus === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-700 hover:bg-green-600 text-foreground" onClick={() => handleVerify(true)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Onayla
                      </Button>
                      <Button size="sm" className="bg-red-700 hover:bg-red-600 text-foreground" onClick={() => handleVerify(false)}>
                        <XCircle className="w-4 h-4 mr-1" /> Reddet
                      </Button>
                    </div>
                  )}
                  {user?.identityStatus !== "pending" && (
                    <Button size="sm" variant="outline" className="border-border text-foreground/80 hover:bg-accent" onClick={() => handleVerify(!user?.isIdentityVerified)}>
                      {user?.isIdentityVerified ? "Kimliği İptal Et" : "Manuel Onayla"}
                    </Button>
                  )}
                  {(user?.identityFrontUrl || user?.identityBackUrl) && (
                    <div className="mt-3 space-y-2">
                      <h4 className="text-xs text-muted-foreground font-medium">Yüklenen Belgeler</h4>
                      <div className="flex gap-2">
                        {user.identityFrontUrl && (
                          <button
                            onClick={() => openImageModal(user.identityFrontUrl!, "Kimlik Ön Yüz")}
                            className="flex-1 bg-secondary/50 border border-border rounded p-2 text-center hover:bg-accent transition-colors"
                          >
                            <span className="text-xs text-blue-400">Ön Yüz Görüntüle</span>
                          </button>
                        )}
                        {user.identityBackUrl && (
                          <button
                            onClick={() => openImageModal(user.identityBackUrl!, "Kimlik Arka Yüz")}
                            className="flex-1 bg-secondary/50 border border-border rounded p-2 text-center hover:bg-accent transition-colors"
                          >
                            <span className="text-xs text-blue-400">Arka Yüz Görüntüle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-lg p-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2 mb-3">Şifre Sıfırla</h3>
                  <p className="text-xs text-muted-foreground mb-3">Kullanıcının şifresini manuel olarak belirleyin. Kullanıcı bu şifreyle giriş yapıp ardından profilinden değiştirebilir.</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Yeni Şifre</label>
                      <input
                        type="password"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Şifre Tekrar</label>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        placeholder="Şifreyi tekrar girin"
                        className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded outline-none focus:border-primary"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-1"
                      onClick={handlePasswordReset}
                      disabled={pwSaving || !newPw || !confirmPw}
                    >
                      {pwSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Şifreyi Ayarla
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-lg p-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2 mb-3">Bakiye İşlemi</h3>
                  <div className="space-y-2">
                    <select
                      className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded"
                      value={balanceForm.type}
                      onChange={e => setBalanceForm(f => ({ ...f, type: e.target.value }))}
                    >
                      <option value="add">Bakiye Ekle</option>
                      <option value="subtract">Bakiye Çıkar</option>
                      <option value="set">Bakiye Ayarla</option>
                    </select>
                    <Input placeholder={`Tutar (${(user as any)?.balanceCurrency === "USD" || (user as any)?.isMetalAccount ? "$" : "₺"})`} value={balanceForm.amount} onChange={e => setBalanceForm(f => ({ ...f, amount: e.target.value }))} className="bg-secondary/50 border-border text-foreground" />
                    <Input placeholder="Not (isteğe bağlı)" value={balanceForm.note} onChange={e => setBalanceForm(f => ({ ...f, note: e.target.value }))} className="bg-secondary/50 border-border text-foreground" />
                    <Button className="w-full bg-primary hover:bg-primary/80" onClick={handleBalanceSave}>
                      <Wallet className="w-4 h-4 mr-2" /> Bakiye Güncelle
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-lg p-4">
                  <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2 mb-3">Hesap Ayarları</h3>
                  {!showUserEdit ? (
                    <div className="space-y-2 text-sm">
                      {[
                        ["Hesap Türü", user?.accountType],
                        ["Spread %", user?.spreadPercent],
                        ["Komisyon %", user?.commissionPercent],
                      ].map(([label, value]) => (
                        <div key={label as string} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-foreground">{value}</span>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" className="border-border text-foreground/80 hover:bg-accent mt-2"
                        onClick={() => {
                          setUserForm({ accountType: user?.accountType as AdminUpdateUserRequest["accountType"], spreadPercent: user?.spreadPercent, commissionPercent: user?.commissionPercent });
                          setShowUserEdit(true);
                        }}>Düzenle</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-1.5 rounded" value={userForm?.accountType || "standard"} onChange={e => setUserForm(f => ({ ...f, accountType: e.target.value as AdminUpdateUserRequest["accountType"] }))}>
                        <option value="standard">Standart</option>
                        <option value="silver">Gümüş</option>
                        <option value="gold">Altın</option>
                        <option value="diamond">Elmas</option>
                      </select>
                      <Input placeholder="Spread %" value={userForm?.spreadPercent ?? ""} onChange={e => setUserForm(f => ({ ...f, spreadPercent: parseFloat(e.target.value) }))} className="bg-secondary/50 border-border text-foreground" />
                      <Input placeholder="Komisyon %" value={userForm?.commissionPercent ?? ""} onChange={e => setUserForm(f => ({ ...f, commissionPercent: parseFloat(e.target.value) }))} className="bg-secondary/50 border-border text-foreground" />
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-primary hover:bg-primary/80" onClick={handleUserSave}>Kaydet</Button>
                        <Button size="sm" variant="outline" className="border-border text-foreground/80" onClick={() => setShowUserEdit(false)}>İptal</Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* IB Promote Card (super admin only) */}
                {adminUser?.isSuper && !(user as any)?.isIB && (
                  <div className="bg-card rounded-lg p-4">
                    <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider border-b border-border pb-2 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" /> IB Yetkilendirme
                    </h3>
                    {!ibPromoteFormOpen ? (
                      <Button
                        size="sm"
                        className="w-full mb-3 bg-primary text-primary-foreground"
                        onClick={() => setIbPromoteFormOpen(true)}
                      >
                        <Building2 className="w-4 h-4 mr-2" /> IB Olarak Ata
                      </Button>
                    ) : (
                      <div className="mb-3 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">IB Referans Kodu</p>
                        <input
                          type="text"
                          placeholder="Örn: HAKANIB"
                          value={ibReferralCodeInput}
                          onChange={e => setIbReferralCodeInput(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === "Enter" && handlePromoteToIB()}
                          className="w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-2 rounded outline-none focus:border-primary uppercase tracking-widest font-mono"
                          maxLength={12}
                          autoFocus
                        />
                        <p className="text-[10px] text-muted-foreground">Harf ve rakam, 3-12 karakter. Büyük harf otomatik dönüşür.</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => { setIbPromoteFormOpen(false); setIbReferralCodeInput(""); }}>İptal</Button>
                          <Button size="sm" className="flex-1" disabled={ibPromoting || !ibReferralCodeInput.trim()} onClick={handlePromoteToIB}>
                            {ibPromoting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-border pt-3">
                    <h3 className="text-xs font-bold text-foreground/60 uppercase tracking-wider mb-2">IB Transferi</h3>
                    {(user as any)?.parentIbId ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                          <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-amber-700 text-xs">Bu hesap bir IB'ye bağlı (ID: {(user as any).parentIbId})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-red-200 text-red-600 hover:bg-red-50"
                          disabled={ibTransferring}
                          onClick={() => handleAssignIB(null)}
                        >
                          IB Bağlantısını Kaldır
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-border"
                          onClick={() => { loadIBList(); setIbTransferOpen(v => !v); }}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-2" /> Farklı IB'ye Transfer Et
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => { loadIBList(); setIbTransferOpen(v => !v); }}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" /> IB'ye Transfer Et
                      </Button>
                    )}
                    {ibTransferOpen && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Hangi IB'ye bağlansın?</p>
                        {ibList.length === 0 ? (
                          <p className="text-xs text-muted-foreground">IB bulunamadı.</p>
                        ) : (
                          ibList.map((ib: any) => (
                            <button
                              key={ib.id}
                              disabled={ibTransferring || ib.id === (user as any)?.parentIbId}
                              onClick={() => handleAssignIB(ib.id)}
                              className="w-full flex items-center justify-between bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-50"
                            >
                              <div>
                                <div className="text-sm font-semibold text-foreground">{ib.firstName}</div>
                                <div className="text-xs text-muted-foreground font-mono">#{ib.accountId} {ib.ibReferralCode && `· REF: ${ib.ibReferralCode}`}</div>
                              </div>
                              {ib.id === (user as any)?.parentIbId && (
                                <span className="text-xs text-primary font-bold">Mevcut</span>
                              )}
                            </button>
                          ))
                        )}
                        <Button size="sm" variant="outline" className="w-full" onClick={() => setIbTransferOpen(false)}>İptal</Button>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {tab === "open" && <PositionsTable list={openOrdersLive} />}
        {tab === "orders" && <PositionsTable list={pendingOrders} />}
        {tab === "closed" && <PositionsTable list={closedOrders} showReopen />}
        {tab === "ledgers" && <LedgersTable />}

        {tab === "metal" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Emtia & Değerli Metal Hesapları</h3>
              <span className="text-xs text-muted-foreground">{metalSubAccounts.length} hesap</span>
            </div>
            {metalSubAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Bu kullanıcının emtia hesabı bulunmuyor.</div>
            ) : (
              <div className="space-y-3">
                {metalSubAccounts.map((sub) => (
                  <div key={sub.id} className="bg-card border border-amber-200 dark:border-amber-700/40 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{sub.subAccountName || "Değerli Metaller & Emtia"}</span>
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                          1:{sub.leverage ?? 200} Kaldıraç
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          {sub.balanceCurrency}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">Hesap No: <span className="font-mono font-medium">{sub.accountId}</span></div>
                      <div className="text-lg font-bold">
                        {sub.balanceCurrency === "USD"
                          ? `$${(sub.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `₺${(sub.balance ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                    </div>
                    <button
                      onClick={() => setMetalSubAccountId(sub.id)}
                      className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shrink-0"
                    >
                      Hesabı Aç
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editOrder && (
        <UserEditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSuccess={() => { setEditOrder(null); refetch(); }}
        />
      )}
      {ledgerModal && (
        <LedgerEditModal
          userId={userId}
          ledger={ledgerModal.record}
          onClose={() => setLedgerModal(null)}
          onSuccess={() => { setLedgerModal(null); refetch(); }}
        />
      )}
      </div>
      {showOpenOrder && (
        <UserOpenOrderModal
          userId={userId}
          onClose={() => setShowOpenOrder(false)}
          onSuccess={() => { setShowOpenOrder(false); refetch(); setTab("open"); }}
        />
      )}
      {confirmCancelOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">İşlemi İptal Et</h3>
                <p className="text-muted-foreground text-xs mt-0.5">Bu işlem geri alınamaz</p>
              </div>
            </div>
            <div className="bg-background/60 rounded-lg p-3 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">İşlem No:</span>
                <span className="font-mono font-bold text-foreground">#{confirmCancelOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sembol:</span>
                <span className="font-bold text-blue-300">{confirmCancelOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lot / Yön:</span>
                <span className="text-foreground">{confirmCancelOrder.lots} lot — {confirmCancelOrder.direction === "buy" ? "AL" : "SAT"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">İade Edilecek:</span>
                <span className="font-bold text-green-400">
                  ₺{((confirmCancelOrder.totalAmount || 0) + Math.abs(confirmCancelOrder.commissionAmount || 0)).toFixed(2)}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              İşlem iptal edilecek ve kullanıcının bakiyesine tam iade yapılacak. Emin misiniz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancelOrder(null)}
                disabled={cancellingOrder}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancellingOrder}
                className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancellingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                {cancellingOrder ? "İptal Ediliyor..." : "İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}
      {metalSubAccountId !== null && (
        <UserDetailModal userId={metalSubAccountId} onClose={() => setMetalSubAccountId(null)} />
      )}
    </>
  );
}

function UserOpenOrderModal({ userId, onClose, onSuccess }: { userId: number; onClose: () => void; onSuccess: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ symbol: string; name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("1");
  const [openPrice, setOpenPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const suggRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = symbolInput.trim().toUpperCase();
    if (!q || q.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`/admin/stocks?search=${encodeURIComponent(q)}&limit=12`);
        setSuggestions((data.stocks || []).map((s: any) => ({ symbol: s.symbol, name: s.name || s.symbol })));
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [symbolInput]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = async () => {
    const sym = symbol || symbolInput.trim().toUpperCase();
    if (!sym || !lots) { setError("Hisse ve adet zorunlu"); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/admin/orders", {
        method: "POST",
        body: JSON.stringify({ userId, symbol: sym, direction, lots: Number(lots), openPrice: openPrice ? parseDecimal(openPrice) : undefined }),
      });
      onSuccess();
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-bold text-base">İşlem Aç</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="relative" ref={suggRef}>
            <label className="text-xs font-medium text-muted-foreground">Hisse Senedi</label>
            <input
              type="text"
              value={symbolInput}
              onChange={e => { setSymbolInput(e.target.value); setSymbol(""); }}
              onFocus={() => symbolInput && setShowSuggestions(true)}
              placeholder="THYAO, SASA, AKBNK..."
              className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl max-h-48 overflow-auto">
                {suggestions.map(s => (
                  <button
                    key={s.symbol}
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    onMouseDown={() => { setSymbol(s.symbol); setSymbolInput(s.symbol); setShowSuggestions(false); }}
                  >
                    <span className="font-bold">{s.symbol}</span>
                    <span className="text-muted-foreground text-xs truncate ml-2 max-w-[160px]">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Yön</label>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-border">
              <button type="button" onClick={() => setDirection("buy")} className={`flex-1 py-2 text-sm font-bold transition-colors ${direction === "buy" ? "bg-green-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>ALIŞ</button>
              <button type="button" onClick={() => setDirection("sell")} className={`flex-1 py-2 text-sm font-bold transition-colors ${direction === "sell" ? "bg-red-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>SATIŞ</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Adet (Lot)</label>
              <input type="number" min="1" value={lots} onChange={e => setLots(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Açılış Fiyatı</label>
              <input type="text" inputMode="decimal" value={openPrice} onChange={e => setOpenPrice(e.target.value)} placeholder="Piyasa fiyatı" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            İşlemi Aç
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [isTest, setIsTest] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "", tcNo: "", phone: "", birthDate: "", city: "", district: "" });
  const [loading, setLoading] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ accountId: string; firstName: string; generatedPassword?: string } | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTest && (!form.firstName || !form.lastName || !form.password)) return;
    setLoading(true);
    try {
      const result = await apiFetch("/admin/users/create", {
        method: "POST",
        body: JSON.stringify({ ...form, isTest }),
      });
      setCreatedAccount({
        accountId: result.user.accountId,
        firstName: result.user.firstName,
        generatedPassword: result.generatedPassword,
      });
      toast({ title: "Hesap oluşturuldu", description: result.message });
      onSuccess();
    } catch (e: any) {
      toast({ title: "Hata", description: e, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-secondary/50 border border-border text-foreground text-sm px-3 py-2 rounded-lg outline-none focus:border-primary h-9";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <p className="font-bold text-foreground">Yeni Hesap Oluştur</p>
            <p className="text-xs text-muted-foreground">TC kimlik olmadan hesap açılabilir. Giriş hesap numarası ile yapılır.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
        </div>

        {createdAccount ? (
          <div className="p-6 space-y-4">
            <div className={`border rounded-xl p-4 text-center space-y-2 ${createdAccount.generatedPassword ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
              <CheckCircle2 className={`w-10 h-10 mx-auto ${createdAccount.generatedPassword ? "text-orange-500" : "text-green-500"}`} />
              <p className={`font-bold ${createdAccount.generatedPassword ? "text-orange-800" : "text-green-800"}`}>{createdAccount.firstName} için hesap oluşturuldu!</p>
              {createdAccount.generatedPassword && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg px-3 py-2 text-xs text-orange-700">
                  <span className="font-bold">Test Hesabı</span> — Otomatik şifre: <span className="font-mono font-bold">{createdAccount.generatedPassword}</span>
                </div>
              )}
              <div className={`bg-white border rounded-lg px-4 py-3 ${createdAccount.generatedPassword ? "border-orange-300" : "border-green-300"}`}>
                <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${createdAccount.generatedPassword ? "text-orange-600" : "text-green-600"}`}>Hesap Numarası</p>
                <p className={`text-2xl font-mono font-bold tracking-widest ${createdAccount.generatedPassword ? "text-orange-700" : "text-green-700"}`}>#{createdAccount.accountId}</p>
              </div>
              <p className={`text-xs ${createdAccount.generatedPassword ? "text-orange-600" : "text-green-600"}`}>Bu hesap numarasını müşterinizle paylaşın.</p>
            </div>
            <Button className="w-full" onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-4 space-y-3">
            {/* Test Hesabı Toggle */}
            <div
              onClick={() => setIsTest(v => !v)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer border transition-colors ${
                isTest ? "bg-orange-50 border-orange-300" : "bg-secondary/30 border-border hover:bg-secondary/50"
              }`}
            >
              <div className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${isTest ? "bg-orange-500" : "bg-muted-foreground/30"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isTest ? "left-5" : "left-0.5"}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isTest ? "text-orange-700" : "text-foreground"}`}>Test Hesabı</p>
                <p className="text-xs text-muted-foreground">Ad, soyad ve şifre otomatik oluşturulur</p>
              </div>
            </div>

            {!isTest && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Ad *</label><input required value={form.firstName} onChange={e => set("firstName", e.target.value)} className={inputCls} placeholder="Ad" /></div>
                  <div><label className={labelCls}>Soyad *</label><input required value={form.lastName} onChange={e => set("lastName", e.target.value)} className={inputCls} placeholder="Soyad" /></div>
                </div>
                <div><label className={labelCls}>Şifre *</label><input required type="password" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} placeholder="Giriş şifresi" /></div>
              </>
            )}

            {!isTest && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium mb-2">Opsiyonel Bilgiler</p>
              <div className="space-y-3">
                <div><label className={labelCls}>TC Kimlik No</label><input value={form.tcNo} onChange={e => set("tcNo", e.target.value)} className={inputCls} placeholder="11 hane (opsiyonel)" maxLength={11} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Doğum Tarihi</label><input type="date" value={form.birthDate} onChange={e => set("birthDate", e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Telefon</label><input value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls} placeholder="5xxxxxxxxx" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>İl</label><input value={form.city} onChange={e => set("city", e.target.value)} className={inputCls} placeholder="İstanbul" /></div>
                  <div><label className={labelCls}>İlçe</label><input value={form.district} onChange={e => set("district", e.target.value)} className={inputCls} placeholder="Kadıköy" /></div>
                </div>
              </div>
            </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Oluşturuluyor..." : "Hesap Oluştur"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function UserTable({
  users,
  isLoading,
  onSelect,
  fmtCurrency,
  isUserOnline,
  fmtLastSeen,
  showIbBadge,
}: {
  users: User[];
  isLoading: boolean;
  onSelect: (id: number) => void;
  fmtCurrency: (n: number) => string;
  isUserOnline: (u: User) => boolean;
  fmtLastSeen: (u: User) => string;
  showIbBadge?: boolean;
}) {
  const cols = showIbBadge ? 9 : 8;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/10 border-b border-border text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Hesap No</th>
            <th className="px-4 py-3 text-left">Ad Soyad</th>
            <th className="px-4 py-3 text-left">Telefon</th>
            <th className="px-4 py-3 text-right">Bakiye</th>
            <th className="px-4 py-3 text-center">Durum</th>
            <th className="px-4 py-3 text-center">Tür</th>
            <th className="px-4 py-3 text-center">Kimlik</th>
            {showIbBadge && <th className="px-4 py-3 text-center">Etiket</th>}
            <th className="px-4 py-3 text-center">Detay</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading ? (
            <tr><td colSpan={cols} className="text-center py-8 text-muted-foreground">Yükleniyor...</td></tr>
          ) : users.length === 0 ? (
            <tr><td colSpan={cols} className="text-center py-8 text-muted-foreground">Kullanıcı bulunamadı</td></tr>
          ) : users.map((u) => {
            const online = isUserOnline(u);
            return (
              <tr key={u.id} className="hover:bg-secondary/5 transition-colors cursor-pointer" onClick={() => onSelect(u.id)}>
                <td className="px-4 py-3 font-mono font-bold text-primary">#{u.accountId}</td>
                <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.phone}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtCurrency((u as any).equity ?? u.balance)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                      <span className={`text-[11px] font-semibold ${online ? "text-green-500" : "text-muted-foreground"}`}>
                        {online ? "Çevrimiçi" : "Çevrimdışı"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{fmtLastSeen(u)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    u.accountType === "diamond" ? "bg-purple-900/50 text-purple-300" :
                    u.accountType === "gold" ? "bg-yellow-900/50 text-yellow-300" :
                    u.accountType === "silver" ? "bg-gray-600/50 text-foreground/80" :
                    "bg-secondary/50 text-muted-foreground"
                  }`}>
                    {u.accountType === "diamond" ? "Elmas" : u.accountType === "gold" ? "Altın" : u.accountType === "silver" ? "Gümüş" : "Standart"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {u.isIdentityVerified ? <span className="text-green-400 text-xs font-bold">✓ Onaylı</span> :
                   u.identityStatus === "pending" ? <span className="text-amber-400 text-xs font-bold">Bekliyor</span> :
                   <span className="text-muted-foreground text-xs">-</span>}
                </td>
                {showIbBadge && (
                  <td className="px-4 py-3 text-center">
                    {u.isTest
                      ? <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-900/40 text-orange-300">Test</span>
                      : u.isAdmin
                        ? <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-primary">Admin</span>
                        : u.ibReferralCode
                          ? <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-900/40 text-amber-300">IB</span>
                          : <span className="text-muted-foreground text-xs">-</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={e => { e.stopPropagation(); onSelect(u.id); }}>
                    Hesaba Gir
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function UsersSection() {
  const [search, setSearch] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showTestIb, setShowTestIb] = useState(false);
  const [listNow, setListNow] = useState(() => Date.now());

  const { data: realData, isLoading: realLoading, refetch: refetchReal } = useAdminGetUsers(
    { search: search || undefined, userType: "real", limit: 500 },
    { query: { refetchInterval: 15_000 } }
  );
  const { data: testIbData, isLoading: testIbLoading, refetch: refetchTestIb } = useAdminGetUsers(
    { search: search || undefined, userType: "test_ib", limit: 500 },
    { query: { refetchInterval: 15_000 } }
  );

  const refetch = () => { refetchReal(); refetchTestIb(); };

  useEffect(() => {
    const id = setInterval(() => setListNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  const isUserOnline = (u: User) => {
    if (!u.lastSeenAt) return false;
    return listNow - new Date(u.lastSeenAt).getTime() < 2 * 60 * 1000;
  };

  const fmtLastSeen = (u: User) => {
    if (!u.lastSeenAt) return "Giriş yok";
    const diff = listNow - new Date(u.lastSeenAt).getTime();
    if (diff < 60_000) return "Az önce";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk önce`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} sa önce`;
    return new Date(u.lastSeenAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });
  };

  const allReal: User[] = realData?.users || [];
  const allTestIb: User[] = testIbData?.users || [];
  const realUsers = onlineOnly ? allReal.filter(isUserOnline) : allReal;
  const testIbUsers = onlineOnly ? allTestIb.filter(isUserOnline) : allTestIb;
  const onlineCount = allReal.filter(isUserOnline).length;

  return (
    <div className="space-y-5">
      {selectedUserId && <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); refetch(); }} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">Kullanıcı Listesi</h3>
          <button
            onClick={() => setOnlineOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              onlineOnly
                ? "bg-green-500/10 border-green-500/40 text-green-600"
                : "bg-muted border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${onlineOnly ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            Çevrimiçi ({onlineCount})
          </button>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="İsim, telefon veya hesap no..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-card" />
          </div>
          <Button size="sm" className="h-9 gap-1.5 whitespace-nowrap" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Yeni Hesap
          </Button>
        </div>
      </div>

      {/* ─── BÖLÜM 1: Gerçek Hesaplar ─────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-bold text-foreground">Gerçek Hesaplar</h4>
          <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{realData?.total ?? 0} hesap</span>
        </div>

        {/* Stats bar — only real accounts count toward total balance */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <div className="text-xs text-muted-foreground mb-0.5">Toplam Hesap</div>
            <div className="text-lg font-bold text-foreground">{realData?.total ?? 0}</div>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <div className="text-xs text-muted-foreground mb-0.5">Toplam Bakiye</div>
            <div className="text-lg font-bold text-primary tabular-nums">
              {fmtCurrency(realData?.totalBalance ?? 0)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <div className="text-xs text-muted-foreground mb-0.5">Çevrimiçi</div>
            <div className="text-lg font-bold text-green-400">{onlineCount}</div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <UserTable
            users={realUsers}
            isLoading={realLoading}
            onSelect={setSelectedUserId}
            fmtCurrency={fmtCurrency}
            isUserOnline={isUserOnline}
            fmtLastSeen={fmtLastSeen}
            showIbBadge={false}
          />
          {realData && (
            <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground bg-secondary/5">
              {realUsers.length} / {realData.total} gerçek hesap gösteriliyor
            </div>
          )}
        </div>
      </div>

      {/* ─── BÖLÜM 2: Test & IB Hesapları (collapsible) ────────── */}
      <div className="space-y-2">
        <button
          onClick={() => setShowTestIb(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-border bg-secondary/20 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-muted-foreground">Test & IB Hesapları</h4>
            <span className="text-xs text-muted-foreground bg-secondary/70 px-2 py-0.5 rounded-full">{testIbData?.total ?? 0} hesap</span>
            <span className="text-xs text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold">
              Toplam bakiyeye dahil değil
            </span>
          </div>
          <span className="text-muted-foreground text-xs">{showTestIb ? "▲ Gizle" : "▼ Göster"}</span>
        </button>

        {showTestIb && (
          <div className="bg-card rounded-xl border border-dashed border-border/60 overflow-hidden">
            <div className="px-4 py-2 border-b border-border/40 bg-amber-500/5 flex items-center justify-between">
              <span className="text-xs text-amber-600 font-semibold">Bu hesapların bakiyesi toplam istatistiklere yansımaz</span>
              <span className="text-xs text-muted-foreground">{fmtCurrency(testIbData?.totalBalance ?? 0)} toplam bakiye</span>
            </div>
            <UserTable
              users={testIbUsers}
              isLoading={testIbLoading}
              onSelect={setSelectedUserId}
              fmtCurrency={fmtCurrency}
              isUserOnline={isUserOnline}
              fmtLastSeen={fmtLastSeen}
              showIbBadge={true}
            />
            {testIbData && (
              <div className="px-4 py-2.5 border-t border-border/40 text-xs text-muted-foreground bg-secondary/5">
                {testIbUsers.length} / {testIbData.total} test & IB hesabı gösteriliyor
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
