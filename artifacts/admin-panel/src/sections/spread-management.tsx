import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, X, ChevronRight, ChevronLeft, Search, Check, Percent, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/api/admin";
function authHeaders() {
  const token = localStorage.getItem("admin_auth_token") || localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(BASE + path, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || r.statusText); }
  return r.json();
}

interface BistStock { symbol: string; name: string; }
interface GlobalSpread { id: number; symbol: string; buySpread: number; sellSpread: number; }
interface Group { id: number; name: string; description?: string; memberCount: number; createdAt: string; }
interface GroupStock { id: number; groupId: number; symbol: string; buySpread: number; sellSpread: number; }
interface Member { id: number; accountId: string; firstName: string; lastName: string; phone?: string; }

function formatDate(s: string) { return new Date(s).toLocaleDateString("tr-TR"); }

const DEFAULT_SPREAD = 0.5;

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export default function SpreadManagementSection() {
  const [mainTab, setMainTab] = useState<"global" | "emtia" | "groups">("global");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  if (selectedGroup) {
    return <GroupDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Spread Yönetimi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Hisse bazlı spread değerlerini <strong>lot başına ₺</strong>, emtia spreadlerini <strong>$/kontrakt</strong> cinsinden tanımlayın.
          </p>
        </div>
      </div>

      <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-1 w-fit mb-6">
        {([["global", "Hisse Spreadleri"], ["emtia", "Emtia Spreadleri"], ["groups", "Özel Gruplar"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={cn("px-5 py-1.5 rounded-md text-sm font-medium transition-all",
              mainTab === id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </button>
        ))}
      </div>

      {mainTab === "global" ? <GlobalSpreads /> : mainTab === "emtia" ? <CommoditySpreads /> : <GroupList onSelect={setSelectedGroup} />}
    </div>
  );
}

// ─── Emtia Spreadleri ─────────────────────────────────────────────────────────
const COMMODITY_INSTRUMENTS = [
  { symbol: "XAUTRYG", display: "XAUUSD", name: "Ons Altın", unit: "100 oz/kontrakt", emoji: "🥇" },
  { symbol: "XAGTRYG", display: "XAGUSD", name: "Ons Gümüş", unit: "5.000 oz/kontrakt", emoji: "🥈" },
  { symbol: "BRENTOIL", display: "BRENTOIL", name: "Brent Ham Petrol", unit: "1.000 varil/kontrakt", emoji: "🛢️" },
  { symbol: "WTIOIL",   display: "WTIOIL",   name: "WTI Ham Petrol",   unit: "1.000 varil/kontrakt", emoji: "⛽" },
];

function CommoditySpreads() {
  const [spreads, setSpreads] = useState<GlobalSpread[]>([]);
  const [editRow, setEditRow] = useState<{ symbol: string; buy: string; sell: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    apiFetch("/global-spreads")
      .then((gs) => setSpreads(gs as GlobalSpread[]))
      .catch(() => toast({ title: "Yükleme hatası", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const spreadMap = new Map(spreads.map(s => [s.symbol, s]));

  const save = async (symbol: string, buy: number, sell: number) => {
    try {
      const row = await apiFetch(`/global-spreads/${symbol}`, {
        method: "PUT", body: JSON.stringify({ buySpread: buy, sellSpread: sell }),
      });
      setSpreads(prev => {
        const exists = prev.find(s => s.symbol === symbol);
        return exists ? prev.map(s => s.symbol === symbol ? row : s) : [...prev, row];
      });
      setEditRow(null);
      toast({ title: `${symbol} emtia spreadi güncellendi` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const reset = async (symbol: string) => {
    if (!confirm(`${symbol} için spread sıfırlanacak. Emin misiniz?`)) return;
    try {
      await apiFetch(`/global-spreads/${symbol}`, { method: "DELETE" });
      setSpreads(prev => prev.filter(s => s.symbol !== symbol));
      toast({ title: `${symbol} spreadi sıfırlandı` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  return (
    <div>
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800 dark:text-amber-300">
        Emtia spreadi <strong>$/kontrakt</strong> cinsinden tanımlanır. Kaldıraçlı hesaplarda her kontrakt açılışında bu miktar tahsil edilir.
      </div>
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Enstrüman</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Alış Spread ($/kontrakt)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Satış Spread ($/kontrakt)</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMMODITY_INSTRUMENTS.map((inst) => {
                const custom = spreadMap.get(inst.symbol);
                const isEditing = editRow?.symbol === inst.symbol;
                const buyVal = custom?.buySpread ?? 0;
                const sellVal = custom?.sellSpread ?? 0;
                return (
                  <tr key={inst.symbol} className={cn("transition-colors", custom ? "bg-amber-50/50 dark:bg-amber-900/10" : "")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{inst.emoji}</span>
                        <div>
                          <div className="font-semibold">{inst.display}</div>
                          <div className="text-xs text-muted-foreground">{inst.name} · {inst.unit}</div>
                        </div>
                        {custom && (
                          <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">Özel</span>
                        )}
                      </div>
                    </td>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2 text-right">
                          <Input type="number" step="0.01" value={editRow.buy} onChange={e => setEditRow(r => r ? { ...r, buy: e.target.value } : r)} className="w-28 ml-auto text-right h-8 text-sm" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input type="number" step="0.01" value={editRow.sell} onChange={e => setEditRow(r => r ? { ...r, sell: e.target.value } : r)} className="w-28 ml-auto text-right h-8 text-sm" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => save(inst.symbol, parseFloat(editRow.buy) || 0, parseFloat(editRow.sell) || 0)}
                              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/80"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditRow(null)}
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary/50"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {custom ? <span className="text-primary font-bold">${buyVal.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">
                          {custom ? <span className="text-primary font-bold">${sellVal.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setEditRow({ symbol: inst.symbol, buy: String(buyVal), sell: String(sellVal) })}
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary/50"><Pencil className="w-3.5 h-3.5" /></button>
                            {custom && (
                              <button onClick={() => reset(inst.symbol)}
                                className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive"><RotateCcw className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Global Spreadler ─────────────────────────────────────────────────────────
function GlobalSpreads() {
  const [allStocks, setAllStocks] = useState<BistStock[]>([]);
  const [globalSpreads, setGlobalSpreads] = useState<GlobalSpread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<{ symbol: string; buy: string; sell: string } | null>(null);
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);
  const { toast } = useToast();

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/stocks?limit=1000&page=1"),
      apiFetch("/global-spreads"),
    ]).then(([stocksRes, gs]) => {
      setAllStocks((stocksRes.stocks || []) as BistStock[]);
      setGlobalSpreads(gs as GlobalSpread[]);
    }).catch(() => toast({ title: "Yükleme hatası", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const spreadMap = new Map(globalSpreads.map(g => [g.symbol, g]));

  const save = async (symbol: string, buy: number, sell: number) => {
    try {
      const row = await apiFetch(`/global-spreads/${symbol}`, {
        method: "PUT", body: JSON.stringify({ buySpread: buy, sellSpread: sell })
      });
      setGlobalSpreads(prev => {
        const exists = prev.find(s => s.symbol === symbol);
        return exists ? prev.map(s => s.symbol === symbol ? row : s) : [...prev, row];
      });
      setEditRow(null);
      toast({ title: `${symbol} global spreadi güncellendi` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const resetToDefault = async (symbol: string) => {
    if (!confirm(`${symbol} için özel TL spread kaldırılacak. Kullanıcılar kendi varsayılan yüzde spreadine dönecek. Emin misiniz?`)) return;
    try {
      await apiFetch(`/global-spreads/${symbol}`, { method: "DELETE" });
      setGlobalSpreads(prev => prev.filter(s => s.symbol !== symbol));
      toast({ title: `${symbol} spreadi varsayılana döndürüldü` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const q = search.toUpperCase();
  const displayStocks = showOnlyCustom
    ? globalSpreads.filter(s => !q || s.symbol.includes(q))
    : allStocks.filter(s => !q || s.symbol.includes(q) || s.name?.toUpperCase().includes(q));

  const customCount = globalSpreads.length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Hisse sembolü veya adı ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setShowOnlyCustom(!showOnlyCustom)}
          className={cn("px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
            showOnlyCustom ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
          )}>
          {showOnlyCustom ? `Özelleştirilmiş (${customCount})` : `Tümü (${allStocks.length})`}
        </button>
      </div>

      {customCount > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          <span className="text-primary font-semibold">{customCount}</span> hisse için özel TL spread tanımlı.
          Geri kalan hisseler kullanıcının varsayılan yüzde bazlı spreadini kullanır.
        </p>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Yükleniyor...</div>
      ) : displayStocks.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">Sonuç bulunamadı</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hisse</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Alış Spread (₺/lot)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Satış Spread (₺/lot)</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(showOnlyCustom ? displayStocks as GlobalSpread[] : displayStocks as BistStock[]).map((item: any) => {
                const symbol: string = item.symbol;
                const custom = spreadMap.get(symbol);
                const isCustom = !!custom;
                const buyVal = custom?.buySpread ?? 0;
                const sellVal = custom?.sellSpread ?? 0;
                const isEditing = editRow?.symbol === symbol;

                return (
                  <tr key={symbol} className={cn("hover:bg-secondary/5", isCustom && !isEditing && "bg-primary/3")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono">{symbol}</span>
                        {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">ÖZEL</span>}
                      </div>
                      {item.name && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.name}</p>}
                    </td>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2 text-right">
                          <Input type="number" step="0.01" min="0" className="w-24 ml-auto h-8"
                            value={editRow.buy} onChange={e => setEditRow({ ...editRow, buy: e.target.value })} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input type="number" step="0.01" min="0" className="w-24 ml-auto h-8"
                            value={editRow.sell} onChange={e => setEditRow({ ...editRow, sell: e.target.value })} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" className="h-7 w-7 p-0"
                              onClick={() => save(symbol, Number(editRow.buy), Number(editRow.sell))}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditRow(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          {isCustom ? (
                            <span className="font-medium text-foreground">₺{buyVal.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">%{DEFAULT_SPREAD.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isCustom ? (
                            <span className="font-medium text-foreground">₺{sellVal.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">%{DEFAULT_SPREAD.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Düzenle"
                              onClick={() => setEditRow({ symbol, buy: String(buyVal), sell: String(sellVal) })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {isCustom && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Varsayılana sıfırla"
                                onClick={() => resetToDefault(symbol)}>
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Group List ───────────────────────────────────────────────────────────────
function GroupList({ onSelect }: { onSelect: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    apiFetch("/spread-groups").then(setGroups)
      .catch(() => toast({ title: "Hata", variant: "destructive" }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editId) {
        const g = await apiFetch(`/spread-groups/${editId}`, { method: "PUT", body: JSON.stringify({ name, description: desc }) });
        setGroups(prev => prev.map(x => x.id === editId ? { ...x, ...g } : x));
        toast({ title: "Güncellendi" });
      } else {
        await apiFetch("/spread-groups", { method: "POST", body: JSON.stringify({ name, description: desc }) });
        toast({ title: "Grup oluşturuldu" });
        load();
      }
      setName(""); setDesc(""); setShowCreate(false); setEditId(null);
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bu grubu silmek istediğinizden emin misiniz? Üyeler genel spread listesine döner.")) return;
    try {
      await apiFetch(`/spread-groups/${id}`, { method: "DELETE" });
      setGroups(prev => prev.filter(g => g.id !== id));
      toast({ title: "Grup silindi" });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Gruba atanan kullanıcılar, o gruba tanımlı spread oranlarını kullanır. Gruptan çıkan kullanıcılar genel listedeki spreadlere döner.
        </p>
        <Button onClick={() => { setShowCreate(!showCreate); setEditId(null); setName(""); setDesc(""); }} size="sm" className="gap-2 ml-4 flex-shrink-0">
          <Plus className="w-4 h-4" /> Yeni Grup
        </Button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">{editId ? "Grubu Düzenle" : "Yeni Grup Oluştur"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Grup adı (örn: VIP Müşteriler)" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Açıklama (isteğe bağlı)" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleSave} size="sm">{editId ? "Güncelle" : "Oluştur"}</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCreate(false); setEditId(null); }}>İptal</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
      ) : groups.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Percent className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Henüz özel spread grubu yok</p>
          <p className="text-sm text-muted-foreground mt-1">Yeni Grup butonuyla başlayın</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {g.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{g.name}</p>
                {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{g.memberCount} üye · {formatDate(g.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditId(g.id); setName(g.name); setDesc(g.description || ""); setShowCreate(true); }} className="h-8 w-8 p-0">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(g.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="default" size="sm" onClick={() => onSelect(g)} className="h-8 gap-1.5">
                  Yönet <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Group Detail ─────────────────────────────────────────────────────────────
function GroupDetail({ group, onBack }: { group: Group; onBack: () => void }) {
  const [tab, setTab] = useState<"spreads" | "members">("spreads");
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-8">
          <ChevronLeft className="w-4 h-4" /> Gruplar
        </Button>
        <div className="w-px h-5 bg-border" />
        <div>
          <h2 className="text-xl font-bold">{group.name}</h2>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
        </div>
      </div>

      <div className="bg-secondary/10 border border-border rounded-lg p-3 mb-5 text-sm text-muted-foreground">
        Bu gruptaki spread değerleri <strong>lot başına ₺</strong> cinsindendir ve yalnızca bu grubun üyelerini etkiler.
        Gruptan çıkarılan üyeler genel TL spreadlere veya kendi varsayılan yüzde spreadlerine döner.
      </div>

      <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-1 w-fit mb-6">
        {(["spreads", "members"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === t ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "spreads" ? "Spread Oranları" : `Üyeler (${group.memberCount})`}
          </button>
        ))}
      </div>

      {tab === "spreads" ? <GroupSpreads group={group} /> : <GroupMembers group={group} />}
    </div>
  );
}

// ─── Group Spreads ────────────────────────────────────────────────────────────
function GroupSpreads({ group }: { group: Group }) {
  const [stocks, setStocks] = useState<GroupStock[]>([]);
  const [allStocks, setAllStocks] = useState<BistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<{ symbol: string; buy: string; sell: string } | null>(null);
  const [addSymbol, setAddSymbol] = useState("");
  const [addBuy, setAddBuy] = useState("0.5");
  const [addSell, setAddSell] = useState("0.5");
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/spread-groups/${group.id}/stocks`),
      apiFetch("/stocks?limit=1000&page=1").catch(() => ({ stocks: [] })),
    ]).then(([gs, stocksRes]) => {
      setStocks(gs);
      setAllStocks((stocksRes.stocks || []) as BistStock[]);
    }).finally(() => setLoading(false));
  }, [group.id]);

  const save = async (symbol: string, buySpread: number, sellSpread: number) => {
    try {
      const updated = await apiFetch(`/spread-groups/${group.id}/stocks/${symbol}`, {
        method: "PUT", body: JSON.stringify({ buySpread, sellSpread })
      });
      setStocks(prev => {
        const exists = prev.find(s => s.symbol === symbol);
        return exists ? prev.map(s => s.symbol === symbol ? updated : s) : [...prev, updated];
      });
      setEditRow(null); setShowAdd(false); setAddSymbol(""); setAddBuy("0.5"); setAddSell("0.5"); setAddSearch("");
      toast({ title: `${symbol} grup spreadi güncellendi` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const remove = async (symbol: string) => {
    if (!confirm(`${symbol} bu gruptan kaldırılacak. Grup üyeleri bu hisse için genel spreadi kullanacak.`)) return;
    try {
      await apiFetch(`/spread-groups/${group.id}/stocks/${symbol}`, { method: "DELETE" }).catch(() => null);
      setStocks(prev => prev.filter(s => s.symbol !== symbol));
      toast({ title: `${symbol} grup spreadinden kaldırıldı` });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const usedSymbols = new Set(stocks.map(s => s.symbol));
  const availableForAdd = allStocks
    .filter(s => !usedSymbols.has(s.symbol))
    .filter(s => !addSearch || s.symbol.includes(addSearch.toUpperCase()) || s.name?.toUpperCase().includes(addSearch.toUpperCase()));

  const filtered = stocks.filter(s => !search || s.symbol.includes(search.toUpperCase()));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Hisse ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Hisse Ekle
        </Button>
      </div>

      {showAdd && (
        <div className="bg-secondary/20 border border-border rounded-xl p-4 mb-4 space-y-3">
          <p className="text-sm font-medium">Gruba Hisse Ekle</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Hisse ara..." value={addSearch}
              onChange={e => { setAddSearch(e.target.value); setAddSymbol(""); }} />
          </div>
          <div className="max-h-40 overflow-y-auto border border-border rounded-lg bg-background divide-y divide-border">
            {availableForAdd.slice(0, 50).map(s => (
              <button key={s.symbol}
                onClick={() => { setAddSymbol(s.symbol); setAddSearch(s.symbol); }}
                className={cn("w-full text-left px-3 py-2 text-sm hover:bg-secondary/30 flex items-center justify-between",
                  addSymbol === s.symbol && "bg-primary/10 text-primary font-medium"
                )}>
                <span className="font-mono font-bold">{s.symbol}</span>
                <span className="text-xs text-muted-foreground truncate ml-3">{s.name}</span>
              </button>
            ))}
            {availableForAdd.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Hisse bulunamadı</p>
            )}
          </div>
          {addSymbol && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Alış Spread (₺/lot)</label>
                <Input type="number" step="0.01" min="0" className="w-28" value={addBuy} onChange={e => setAddBuy(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Satış Spread (₺/lot)</label>
                <Input type="number" step="0.01" min="0" className="w-28" value={addSell} onChange={e => setAddSell(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => save(addSymbol, Number(addBuy), Number(addSell))}>
                <Check className="w-4 h-4 mr-1" /> Kaydet
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setAddSymbol(""); setAddSearch(""); }}>
                İptal
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          {stocks.length === 0
            ? "Bu grupta henüz özel spread tanımlanmamış. Hisse ekleyerek başlayın."
            : "Arama sonucu bulunamadı."}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hisse</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Alış Spread (₺/lot)</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Satış Spread (₺/lot)</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => (
                <tr key={s.symbol} className="hover:bg-secondary/5">
                  <td className="px-4 py-3 font-bold font-mono">{s.symbol}</td>
                  {editRow?.symbol === s.symbol ? (
                    <>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" step="0.01" min="0" className="w-24 ml-auto h-8"
                          value={editRow.buy} onChange={e => setEditRow({ ...editRow, buy: e.target.value })} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" step="0.01" min="0" className="w-24 ml-auto h-8"
                          value={editRow.sell} onChange={e => setEditRow({ ...editRow, sell: e.target.value })} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" className="h-7 w-7 p-0"
                            onClick={() => save(s.symbol, Number(editRow.buy), Number(editRow.sell))}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditRow(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right font-medium">₺{s.buySpread.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium">₺{s.sellSpread.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => setEditRow({ symbol: s.symbol, buy: String(s.buySpread), sell: String(s.sellSpread) })}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => remove(s.symbol)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Group Members ────────────────────────────────────────────────────────────
function GroupMembers({ group }: { group: Group }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch(`/spread-groups/${group.id}/users`),
      apiFetch("/users?limit=500").catch(() => ({ users: [] })),
    ]).then(([m, u]) => {
      setMembers(m);
      setAllUsers(Array.isArray(u) ? u : u.users || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [group.id]);

  const addUser = async (userId: number) => {
    try {
      await apiFetch(`/spread-groups/${group.id}/users`, { method: "POST", body: JSON.stringify({ userId }) });
      toast({ title: "Kullanıcı gruba eklendi" });
      load();
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const removeUser = async (userId: number) => {
    try {
      await apiFetch(`/spread-groups/${group.id}/users/${userId}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.id !== userId));
      toast({ title: "Kullanıcı gruptan çıkarıldı — genel spread listesine döndü" });
    } catch (e: any) { toast({ title: "Hata", description: e.message, variant: "destructive" }); }
  };

  const memberIds = new Set(members.map(m => m.id));
  const nonMembers = allUsers.filter(u => !memberIds.has(u.id) &&
    (!userSearch || `${u.firstName} ${u.lastName} ${u.accountId}`.toLowerCase().includes(userSearch.toLowerCase()))
  );
  const filtered = members.filter(m =>
    !search || `${m.firstName} ${m.lastName} ${m.accountId}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Üye ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Kullanıcı Ekle
        </Button>
      </div>

      {showAdd && (
        <div className="bg-secondary/20 border border-border rounded-xl p-4 mb-4">
          <p className="text-sm font-medium mb-2">Gruba Kullanıcı Ekle</p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Kullanıcı ara..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {nonMembers.slice(0, 30).map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-background/60">
                <span className="text-sm">{u.firstName} {u.lastName} <span className="text-muted-foreground text-xs">#{u.accountId}</span></span>
                <Button size="sm" className="h-7" onClick={() => addUser(u.id)}>Ekle</Button>
              </div>
            ))}
            {nonMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Eklenecek kullanıcı bulunamadı</p>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          {members.length === 0 ? "Bu grupta henüz üye yok." : "Arama sonucu bulunamadı."}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/10 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hesap No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefon</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-secondary/5">
                  <td className="px-4 py-3 font-medium">{m.firstName} {m.lastName}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.accountId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.phone || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive gap-1" onClick={() => removeUser(m.id)}>
                      <X className="w-3.5 h-3.5" /> Çıkar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
