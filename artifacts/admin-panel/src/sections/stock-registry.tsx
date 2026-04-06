import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, TrendingUp, Database, Zap } from "lucide-react";
const API = (path: string) => `/api${path}`;

interface BistStock {
  symbol: string;
  name: string;
  isActive: boolean;
  isAutoDiscovered: boolean;
  lastSeen: string | null;
  addedAt: string;
}

export default function StockRegistry() {
  const [stocks, setStocks] = useState<BistStock[]>([]);
  const [total, setTotal] = useState(0);
  const [liveCount, setLiveCount] = useState(0);
  const [registryCount, setRegistryCount] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");

  const token = localStorage.getItem("auth_token");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("search", search);
      const r = await fetch(API(`/admin/stocks?${params}`), { headers });
      const data = await r.json();
      setStocks(data.stocks || []);
      setTotal(data.total || 0);
      setLiveCount(data.liveCount || 0);
      setRegistryCount(data.registryCount || 0);
    } catch {
      toast.error("Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handleToggleActive = async (symbol: string, current: boolean) => {
    await fetch(API(`/admin/stocks/${symbol}`), {
      method: "PATCH", headers,
      body: JSON.stringify({ isActive: !current }),
    });
    fetchStocks();
  };

  const handleAdd = async () => {
    if (!newSymbol || !newName) return;
    const r = await fetch(API("/admin/stocks"), {
      method: "POST", headers,
      body: JSON.stringify({ symbol: newSymbol.toUpperCase(), name: newName }),
    });
    if (r.ok) {
      toast.success(`${newSymbol.toUpperCase()} eklendi`);
      setAddOpen(false);
      setNewSymbol(""); setNewName("");
      fetchStocks();
    } else {
      toast.error("Eklenemedi");
    }
  };

  const handleDiscovery = async (mode: "light" | "full") => {
    setDiscoveryRunning(true);
    toast.info(`Discovery başlatıldı (${mode === "full" ? "Tam" : "Hızlı"})...`);
    try {
      await fetch(API("/admin/stocks/discovery/run"), {
        method: "POST", headers,
        body: JSON.stringify({ mode }),
      });
      // Wait a bit then refresh
      setTimeout(() => { fetchStocks(); setDiscoveryRunning(false); }, 30_000);
    } catch {
      setDiscoveryRunning(false);
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">Veritabanı</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{registryCount}</div>
                <div className="text-xs text-muted-foreground">Aktif Registry</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{liveCount}</div>
                <div className="text-xs text-muted-foreground">Canlı Fiyat</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{Math.round((liveCount / Math.max(registryCount, 1)) * 100)}%</div>
                <div className="text-xs text-muted-foreground">Kapsama</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <CardTitle>Hisse Senedi Kayıtları</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleDiscovery("light")} disabled={discoveryRunning}>
                <RefreshCw className={`h-4 w-4 mr-1 ${discoveryRunning ? "animate-spin" : ""}`} />
                Hızlı Keşif
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDiscovery("full")} disabled={discoveryRunning}>
                <Search className="h-4 w-4 mr-1" />
                Tam Keşif
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Hisse Ekle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sembol veya şirket adı..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Sembol</th>
                  <th className="text-left p-3 font-medium">Şirket Adı</th>
                  <th className="text-left p-3 font-medium">Kaynak</th>
                  <th className="text-left p-3 font-medium">Eklenme</th>
                  <th className="text-center p-3 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Yükleniyor...</td></tr>
                ) : stocks.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Hisse bulunamadı</td></tr>
                ) : stocks.map(s => (
                  <tr key={s.symbol} className="border-t hover:bg-muted/20">
                    <td className="p-3 font-mono font-semibold">{s.symbol}</td>
                    <td className="p-3 max-w-xs truncate">{s.name}</td>
                    <td className="p-3">
                      {s.isAutoDiscovered
                        ? <Badge variant="secondary" className="text-xs">Otomatik</Badge>
                        : <Badge variant="outline" className="text-xs">Manuel</Badge>
                      }
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {new Date(s.addedAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}
                    </td>
                    <td className="p-3 text-center">
                      <Switch
                        checked={s.isActive}
                        onCheckedChange={() => handleToggleActive(s.symbol, s.isActive)}
                        className="mx-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Toplam {total} hisse · Sayfa {page}/{totalPages}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  Önceki
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Sonraki
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Hisse Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>BIST Sembolü</Label>
              <Input placeholder="THYAO" value={newSymbol} onChange={e => setNewSymbol(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1">
              <Label>Şirket Adı</Label>
              <Input placeholder="Türk Hava Yolları A.O." value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>İptal</Button>
            <Button onClick={handleAdd} disabled={!newSymbol || !newName}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
