import { useState, useRef } from "react";
import { useGetExpertPicks, useGetStocks, useAdminAddExpertPick, useAdminRemoveExpertPick, getGetExpertPicksQueryKey, ExpertPickItem, Stock } from "@workspace/api-client-react";
import { Plus, Trash2, Star, Search, TrendingUp, TrendingDown, Upload, X, ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function getApiUrl(path: string) {
  return `/api${path}`;
}

function getToken() {
  return localStorage.getItem("token") || "";
}

function getImageUrl(logoUrl: string) {
  return `/api/image?path=${encodeURIComponent(logoUrl)}`;
}

export default function ExpertPicksSection() {
  const { data: picks, isLoading } = useGetExpertPicks();
  const { data: stocks } = useGetStocks({});
  const { mutate: addPick } = useAdminAddExpertPick();
  const { mutate: removePick } = useAdminRemoveExpertPick();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleAdd = () => {
    if (!selectedSymbol) {
      toast({ title: "Hisse seçin", variant: "destructive" });
      return;
    }
    addPick({ data: { symbol: selectedSymbol, note: note || undefined } }, {
      onSuccess: () => {
        toast({ title: "Uzman seçimi eklendi" });
        queryClient.invalidateQueries({ queryKey: getGetExpertPicksQueryKey() });
        setShowForm(false);
        setSelectedSymbol("");
        setNote("");
        setSearch("");
      },
      onError: () => toast({ title: "Hata oluştu", variant: "destructive" }),
    });
  };

  const handleRemove = (id: number) => {
    removePick({ id }, {
      onSuccess: () => {
        toast({ title: "Uzman seçimi kaldırıldı" });
        queryClient.invalidateQueries({ queryKey: getGetExpertPicksQueryKey() });
      },
    });
  };

  const handleSaveNote = async (id: number) => {
    try {
      await fetch(getApiUrl(`/admin/expert-picks/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ note: editNote }),
      });
      toast({ title: "Not güncellendi" });
      queryClient.invalidateQueries({ queryKey: getGetExpertPicksQueryKey() });
      setEditingId(null);
    } catch {
      toast({ title: "Hata oluştu", variant: "destructive" });
    }
  };

  const handleLogoUpload = async (id: number, file: File) => {
    setUploading(id);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(getApiUrl(`/admin/expert-picks/${id}/logo`), {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Logo yüklendi" });
      queryClient.invalidateQueries({ queryKey: getGetExpertPicksQueryKey() });
    } catch {
      toast({ title: "Logo yüklenemedi", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveLogo = async (id: number) => {
    try {
      await fetch(getApiUrl(`/admin/expert-picks/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ logoUrl: null }),
      });
      toast({ title: "Logo kaldırıldı" });
      queryClient.invalidateQueries({ queryKey: getGetExpertPicksQueryKey() });
    } catch {
      toast({ title: "Hata oluştu", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Yükleniyor...</div>;
  }

  const items: ExpertPickItem[] = picks || [];
  const existingSymbols = new Set(items.map(p => p.symbol));
  const allStocks: Stock[] = stocks || [];
  const filteredStocks = allStocks.filter(s =>
    !existingSymbols.has(s.symbol) &&
    (s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  const fmtCurrency = (n: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Hisseler sayfasında "Uzman Görüşü — Gözde Hisseler" bölümünde gösterilir</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Hisse Ekle
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Hisse ara..." value={search} onChange={e => { setSearch(e.target.value); setSelectedSymbol(""); }} className="pl-9 bg-background" />
          </div>

          {search && filteredStocks.length > 0 && !selectedSymbol && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-background">
              {filteredStocks.slice(0, 10).map(s => (
                <button
                  key={s.symbol}
                  onClick={() => { setSelectedSymbol(s.symbol); setSearch(s.symbol); }}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-secondary/10 transition-colors text-left"
                >
                  <div>
                    <span className="font-bold text-sm">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">{fmtCurrency(s.price)}</span>
                    <span className={`text-xs ml-2 ${(s.changePercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(s.changePercent ?? 0) >= 0 ? "+" : ""}{(s.changePercent ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedSymbol && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm">
              Seçili: <strong>{selectedSymbol}</strong>
            </div>
          )}

          <Input placeholder="Not (isteğe bağlı, emoji destekli — örn: 🚀 Kısa vadeli alım fırsatı)" value={note} onChange={e => setNote(e.target.value)} className="bg-background" />

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={!selectedSymbol}>Ekle</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setSearch(""); setSelectedSymbol(""); setNote(""); }}>İptal</Button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Henüz uzman hissesi eklenmemiş</p>
          <p className="text-xs mt-1">BIST hisselerinden seçim yaparak gözde hisseler listesini oluşturun</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((pick) => {
            const isUp = (pick.change ?? 0) >= 0;
            const isEditingThis = editingId === pick.id;
            return (
              <div key={pick.id} className={`bg-card rounded-xl border p-4 group flex flex-col gap-2 ${isUp ? "border-green-800/30" : "border-red-800/30"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {pick.logoUrl ? (
                      <div className="relative flex-shrink-0">
                        <img src={getImageUrl(pick.logoUrl)} alt={pick.symbol} className="w-9 h-9 rounded-lg object-cover border border-border" />
                        <button
                          onClick={() => handleRemoveLogo(pick.id)}
                          className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Logo sil"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[pick.id]?.click()}
                        disabled={uploading === pick.id}
                        className="w-9 h-9 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors flex-shrink-0"
                        title="Logo yükle"
                      >
                        {uploading === pick.id ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={el => { fileInputRefs.current[pick.id] = el; }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(pick.id, file);
                        e.target.value = "";
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{pick.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{pick.stockName}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2 flex-shrink-0" onClick={() => handleRemove(pick.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-end justify-between">
                  <span className="text-lg font-bold">{fmtCurrency(pick.price ?? 0)}</span>
                  <span className={`flex items-center gap-1 text-sm font-bold ${isUp ? "text-green-400" : "text-red-400"}`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isUp ? "+" : ""}{(pick.changePercent ?? 0).toFixed(2)}%
                  </span>
                </div>

                {isEditingThis ? (
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Not (emoji destekli 🚀)"
                      className="h-7 text-xs bg-background flex-1"
                      onKeyDown={e => { if (e.key === "Enter") handleSaveNote(pick.id); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveNote(pick.id)}>✓</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingId(null)}>✕</Button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 cursor-pointer group/note"
                    onClick={() => { setEditingId(pick.id); setEditNote(pick.note || ""); }}
                  >
                    {pick.note ? (
                      <span className="text-xs text-muted-foreground italic flex-1 line-clamp-1">{pick.note}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 italic flex-1">Not ekle...</span>
                    )}
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/note:opacity-60 transition-opacity flex-shrink-0" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
