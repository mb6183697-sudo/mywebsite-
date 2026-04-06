import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Plus, Edit2, X, Check, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrderRow {
  id: number; userId: number; symbol: string; stockName: string;
  direction: string; lots: number; openPrice: number | null;
  closePrice: number | null; currentPrice: number; totalAmount: number;
  status: string; profitLoss: number | null; commissionAmount: number;
  spreadAdjustment: number; createdAt: string; closedAt: string | null;
  firstName: string | null; lastName: string | null;
  accountId: string | null; phone: string | null;
  hasLivePrice?: boolean;
}

interface UserRow { id: number; firstName: string; lastName: string; accountId: string; phone: string; balance: number; }

const fmt = (n?: number | null) => n != null
  ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n)
  : "—";

const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const parseDecimal = (v: string) => parseFloat(v.replace(",", ".")) || 0;

function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) },
  }).then(r => { if (!r.ok) return r.json().then(d => Promise.reject(d.message || "Hata")); return r.json(); });
}

export default function TradeOrdersSection() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [closeOrder, setCloseOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrders(true);
    fetchUsers();
    // Poll open positions every 5 seconds for live P&L; closed/all every 30s
    const interval = setInterval(() => fetchOrders(false), filter === "open" ? 5_000 : 30_000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchOrders = async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      setOrders(await apiFetch(`/admin/orders?status=${filter}`));
      setLastRefresh(new Date());
    } catch { }
    if (initial) setLoading(false); else setRefreshing(false);
  };

  const fetchUsers = async () => {
    try { const data = await apiFetch("/admin/users"); setUsers(data.users || []); } catch { }
  };

  const handleCloseOrder = async (order: OrderRow, closePrice?: number) => {
    try {
      await apiFetch(`/admin/orders/${order.id}/close`, {
        method: "POST", body: JSON.stringify(closePrice ? { closePrice } : {}),
      });
      setCloseOrder(null); fetchOrders(false);
    } catch (e: any) { setError(String(e)); }
  };

  const handleReopenOrder = async (order: OrderRow) => {
    if (!confirm(`#${order.id} numaralı işlemi yeniden açmak istediğinizden emin misiniz?\nKullanıcının bakiyesi kapanış tutarı kadar azaltılacak.`)) return;
    try {
      await apiFetch(`/admin/orders/${order.id}/reopen`, { method: "POST" });
      fetchOrders(false);
    } catch (e: any) { setError(String(e)); }
  };

  const openCount = orders.filter(o => o.status === "open").length;
  const totalOpenPnl = orders.filter(o => o.status === "open").reduce((s, o) => s + (o.profitLoss ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">İşlem Yönetimi</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-muted-foreground">{openCount} açık işlem</p>
            {filter === "open" && openCount > 0 && (
              <span className={cn("text-sm font-bold", totalOpenPnl >= 0 ? "text-green-400" : "text-red-400")}>
                {totalOpenPnl >= 0 ? "+" : ""}{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(totalOpenPnl)} toplam K/Z
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filter === "open" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full", refreshing ? "bg-yellow-400 animate-pulse" : "bg-green-400 animate-pulse")} />
              {refreshing ? "güncelleniyor…" : lastRefresh ? `${lastRefresh.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit" })} itibarıyla canlı` : "yükleniyor…"}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchOrders(true)}>
            <RefreshCw className={cn("w-4 h-4 mr-1", refreshing && "animate-spin")} /> Yenile
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Yeni İşlem Aç</Button>
        </div>
      </div>

      <div className="flex gap-1 bg-secondary/20 p-1 rounded-lg w-fit">
        {(["open", "closed", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {f === "open" ? "Açık" : f === "closed" ? "Kapalı" : "Tümü"}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/10 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Kullanıcı</th>
                <th className="px-4 py-3 text-left">Hisse</th>
                <th className="px-4 py-3 text-center">Yön</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3 text-right">Açılış</th>
                <th className="px-4 py-3 text-right">Güncel/Kapanış</th>
                <th className="px-4 py-3 text-right">Toplam</th>
                <th className="px-4 py-3 text-right">Swap</th>
                <th className="px-4 py-3 text-right">Komisyon</th>
                <th className="px-4 py-3 text-right">K/Z</th>
                <th className="px-4 py-3 text-left">Tarih</th>
                <th className="px-4 py-3 text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={13} className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={13} className="py-12 text-center text-muted-foreground">İşlem bulunamadı</td></tr>
              )}
              {orders.map(order => {
                const isProfit = (order.profitLoss ?? 0) >= 0;
                const isBuy = order.direction === "buy";
                return (
                  <tr key={order.id} className="hover:bg-secondary/5 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs">#{order.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{order.firstName} {order.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">#{order.accountId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold">{order.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[100px]">{order.stockName}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold", isBuy ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                        {isBuy ? "ALIŞ" : "SATIŞ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{order.lots}</td>
                    <td className="px-4 py-3 text-right">{fmt(order.openPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        {order.status === "open" && order.hasLivePrice && (
                          <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse flex-shrink-0" title="Canlı fiyat" />
                        )}
                        <span>{order.status === "open" ? fmt(order.currentPrice) : fmt(order.closePrice)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(order.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{fmt(order.spreadAdjustment)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{fmt(order.commissionAmount)}</td>
                    <td className={cn("px-4 py-3 text-right font-bold tabular-nums", order.profitLoss != null ? (isProfit ? "text-success" : "text-destructive") : "text-muted-foreground")}>
                      {order.profitLoss != null ? (isProfit ? "+" : "") + fmt(order.profitLoss) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{fmtDate(order.createdAt)}</div>
                      {order.closedAt && <div className="text-blue-400">{fmtDate(order.closedAt)}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditOrder(order)} title="Düzenle">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {order.status === "open" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCloseOrder(order)} title="Kapat">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {order.status === "closed" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:text-amber-400" onClick={() => handleReopenOrder(order)} title="Geri Getir">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg">{error}</div>
      )}

      {showCreate && <CreateOrderModal users={users} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); fetchOrders(false); }} />}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSuccess={() => { setEditOrder(null); fetchOrders(false); }} />}
      {closeOrder && <CloseOrderModal order={closeOrder} onClose={() => setCloseOrder(null)} onConfirm={handleCloseOrder} />}
    </div>
  );
}

function CreateOrderModal({ users, onClose, onSuccess }: { users: UserRow[]; onClose: () => void; onSuccess: () => void }) {
  const [userId, setUserId] = useState("");
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("1");
  const [openPrice, setOpenPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const STOCKS = ["THYAO", "SASA", "EREGL", "BIMAS", "AKBNK", "GARAN", "ASELS", "KCHOL", "PGSUS", "TCELL", "YKBNK", "KOZAL", "TTKOM", "TOASO", "FROTO", "PETKM", "VESTL", "MGROS", "KRDMD", "HALKB"];

  const handleSubmit = async () => {
    if (!userId || !symbol || !lots) { setError("Tüm alanları doldurun"); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/admin/orders", { method: "POST", body: JSON.stringify({ userId: Number(userId), symbol, direction, lots: Number(lots), openPrice: openPrice ? parseDecimal(openPrice) : undefined }) });
      onSuccess();
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-bold text-lg">Yeni İşlem Aç</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Kullanıcı</label>
            <select value={userId} onChange={e => setUserId(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Seçin...</option>
              {users.map(u => <option key={u.id} value={u.id}>#{u.accountId} — {u.firstName} {u.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Hisse</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Seçin...</option>
              {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Yön</label>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setDirection("buy")} className={cn("flex-1 py-2 text-sm font-bold transition-colors", direction === "buy" ? "bg-success text-white" : "bg-background text-muted-foreground hover:bg-secondary/30")}>ALIŞ</button>
              <button onClick={() => setDirection("sell")} className={cn("flex-1 py-2 text-sm font-bold transition-colors", direction === "sell" ? "bg-destructive text-white" : "bg-background text-muted-foreground hover:bg-secondary/30")}>SATIŞ</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Adet (Lot)</label>
              <input type="number" min="1" value={lots} onChange={e => setLots(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Açılış Fiyatı (opsiyonel)</label>
              <input type="text" inputMode="decimal" value={openPrice} onChange={e => setOpenPrice(e.target.value)} placeholder="Piyasa fiyatı" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            İşlemi Aç
          </Button>
        </div>
      </div>
    </div>
  );
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

function EditOrderModal({ order, onClose, onSuccess }: { order: OrderRow; onClose: () => void; onSuccess: () => void }) {
  const [openPrice, setOpenPrice] = useState(String(order.openPrice || ""));
  const [closePrice, setClosePrice] = useState(String(order.closePrice || ""));
  const [lots, setLots] = useState(String(order.lots));
  const [direction, setDirection] = useState(order.direction);
  const [openedAt, setOpenedAt] = useState(toLocalDt(order.createdAt));
  const [closedAt, setClosedAt] = useState(toLocalDt(order.closedAt));
  const [profitLoss, setProfitLoss] = useState(String(order.profitLoss ?? ""));
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
    } catch (e: any) { setError(String(e)); }
    setResetLoading(false);
  };

  const handleSave = async () => {
    setLoading(true); setError("");
    try {
      const body: any = {
        direction,
        lots: Number(lots),
        openPrice: parseDecimal(openPrice),
        openedAt: openedAt || undefined,
      };
      if (isClosed) {
        body.closePrice = closePrice ? parseDecimal(closePrice) : undefined;
        body.closedAt = closedAt || undefined;
        body.profitLoss = profitLoss !== "" ? parseDecimal(profitLoss) : undefined;
      }
      await apiFetch(`/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSuccess();
    } catch (e: any) { setError(String(e)); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold">İşlem Düzenle</h3>
            <p className="text-xs text-muted-foreground">#{order.id} — {order.symbol} ({order.firstName} {order.lastName})</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        {/* İşlem Bilgileri özet bloğu */}
        <div className="mx-5 mt-5 rounded-xl bg-secondary/20 border border-border text-sm divide-y divide-border">
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-muted-foreground">Açılış Seviyesi</span>
            <span className="font-bold">{fmt(order.openPrice)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-muted-foreground">Açılış Zamanı</span>
            <span className="font-medium">{fmtDate(order.createdAt)}</span>
          </div>
          {isClosed && (
            <>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-muted-foreground">Kapanış Seviyesi</span>
                <span className="font-bold">{fmt(order.closePrice)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-muted-foreground">Kapanış Zamanı</span>
                <span className="font-medium">{fmtDate(order.closedAt)}</span>
              </div>
            </>
          )}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Yön</label>
            <div className="mt-1 flex rounded-lg overflow-hidden border border-border">
              <button onClick={() => setDirection("buy")} className={cn("flex-1 py-2 text-sm font-bold transition-colors", direction === "buy" ? "bg-success text-white" : "bg-background text-muted-foreground")}>ALIŞ</button>
              <button onClick={() => setDirection("sell")} className={cn("flex-1 py-2 text-sm font-bold transition-colors", direction === "sell" ? "bg-destructive text-white" : "bg-background text-muted-foreground")}>SATIŞ</button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Adet (Lot)</label>
            <input type="number" min="1" step="1" value={lots} onChange={e => setLots(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Açılış Fiyatı</label>
            <input type="text" inputMode="decimal" value={openPrice} onChange={e => setOpenPrice(e.target.value)} placeholder="ör: 12,50" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
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
            <label className="text-sm font-medium text-muted-foreground">Açılış Tarihi</label>
            <input type="datetime-local" value={openedAt} onChange={e => setOpenedAt(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          {isClosed && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Kapanış Fiyatı</label>
                <input type="text" inputMode="decimal" value={closePrice} onChange={e => setClosePrice(e.target.value)} placeholder="ör: 12,50" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Kapanış Tarihi</label>
                <input type="datetime-local" value={closedAt} onChange={e => setClosedAt(e.target.value)} className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Kar / Zarar (K/Z)</label>
                <input type="text" inputMode="decimal" value={profitLoss} onChange={e => setProfitLoss(e.target.value)} placeholder="ör: -250,00" className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
            <Button className="flex-1" onClick={handleSave} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Kaydet
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseOrderModal({ order, onClose, onConfirm }: { order: OrderRow; onClose: () => void; onConfirm: (order: OrderRow, price?: number) => void }) {
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState(String(order.currentPrice || ""));
  const isBuy = order.direction === "buy";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold">İşlemi Kapat</h3>
            <p className="text-xs text-muted-foreground">#{order.id} — {order.symbol}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-secondary/20 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Kullanıcı</span><span className="font-medium">{order.firstName} {order.lastName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Hisse</span><span className="font-bold">{order.symbol}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Yön</span><span className={cn("font-bold", isBuy ? "text-success" : "text-destructive")}>{isBuy ? "ALIŞ" : "SATIŞ"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Adet</span><span>{order.lots} lot</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Açılış</span><span>{fmt(order.openPrice)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Güncel</span><span className="font-bold">{fmt(order.currentPrice)}</span></div>
            <div className={cn("flex justify-between font-bold", (order.profitLoss ?? 0) >= 0 ? "text-success" : "text-destructive")}>
              <span>Tahmini K/Z</span><span>{fmt(order.profitLoss)}</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={useCustomPrice} onChange={e => setUseCustomPrice(e.target.checked)} className="rounded" />
            Özel kapanış fiyatı belirle
          </label>
          {useCustomPrice && (
            <input type="text" inputMode="decimal" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="ör: 12,50" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
            <Button variant="destructive" className="flex-1" onClick={() => onConfirm(order, useCustomPrice && customPrice ? parseDecimal(customPrice) : undefined)}>
              <X className="w-4 h-4 mr-1" /> Kapat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
