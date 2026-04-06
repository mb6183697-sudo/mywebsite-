import { useState, useRef, useEffect } from "react";
import { useGetStocks, useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useGetExpertPicks, getGetStocksQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { Search, Star, TrendingDown, TrendingUp, LayoutGrid, List, Award, Gem } from "lucide-react";
import { useTrade } from "@/hooks/use-trade";
import { Input } from "@/components/ui/input";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

// Emtia hesabında gösterilecek 4 enstrüman (USD bazlı, sadece bu hesapta görünür)
const METAL_SYMBOLS = ["XAUTRYG", "XAGTRYG", "BRENTOIL", "WTIOIL"];
// Normal hesapta gizlenecek (TRY bazlı verisi olmayan) enstrümanlar
const SPOT_HIDDEN = ["BRENTOIL", "WTIOIL"];

const METAL_LABELS: Record<string, string> = {
  XAUTRYG: "Altın",
  XAGTRYG: "Gümüş",
  BRENTOIL: "Brent Ham Petrol",
  WTIOIL: "WTI Ham Petrol",
};

const METAL_DISPLAY_SYMBOL: Record<string, string> = {
  XAUTRYG: "XAUUSD",
  XAGTRYG: "XAGUSD",
};

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || localStorage.getItem("admin_auth_token");
}

function MetalMiniChart({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const { data } = useQuery<{ data: { t: number; c: number }[] }>({
    queryKey: ["metal-mini-chart", symbol],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/chart?range=1d`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("chart error");
      return res.json();
    },
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const pts = data?.data?.filter(d => d.c != null) ?? [];
  if (pts.length < 2) {
    return <div className="w-20 h-12 flex items-center justify-center"><div className="w-12 h-0.5 bg-border/40 rounded" /></div>;
  }

  const prices = pts.map(d => d.c);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 44;

  const path = prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  const areaPath = `M 0 ${H} ${prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ")} L ${W} ${H} Z`;

  const color = isUp ? "#22c55e" : "#ef4444";
  const gradId = `mg-${symbol}-${isUp ? "u" : "d"}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible flex-shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type FilterType = "all" | "gainers" | "losers" | "most_volume" | "watchlist";
type SortType = "default" | "price_desc" | "price_asc" | "change_desc" | "change_asc" | "volume_desc";

// USD formatter
function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Stocks() {
  const { user } = useAuth();
  const isMetalAccount = !!(user as any)?.isMetalAccount;

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("default");
  
  const { data: stocksRaw, isLoading } = useGetStocks({ 
    search: search || undefined,
    filter: activeFilter !== "all" && activeFilter !== "watchlist" ? activeFilter : undefined,
    watchlistOnly: activeFilter === "watchlist" ? true : undefined,
    sort: sort !== "default" ? sort : undefined,
  }, { query: { queryKey: getGetStocksQueryKey({ search: search || undefined, filter: activeFilter !== "all" && activeFilter !== "watchlist" ? activeFilter : undefined, watchlistOnly: activeFilter === "watchlist" ? true : undefined, sort: sort !== "default" ? sort : undefined }), refetchInterval: 5000 } });

  // Emtia hesabında SADECE 4 enstrüman; normal hesapta BRENTOIL/WTIOIL gizli (XAUTRYG/XAGTRYG görünür)
  const stocks = isMetalAccount
    ? stocksRaw?.filter(s => METAL_SYMBOLS.includes(s.symbol.toUpperCase()))
    : stocksRaw?.filter(s => !SPOT_HIDDEN.includes(s.symbol.toUpperCase()));

  // Flash animation: fiyat değişince yanıp sön
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!stocks || stocks.length === 0) return;
    const newFlash = new Map<string, "up" | "down">();
    stocks.forEach(s => {
      const prev = prevPricesRef.current.get(s.symbol);
      if (prev !== undefined && prev !== s.price) {
        newFlash.set(s.symbol, s.price > prev ? "up" : "down");
      }
      prevPricesRef.current.set(s.symbol, s.price);
    });
    if (newFlash.size > 0) {
      setFlashMap(newFlash);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashMap(new Map()), 1500);
    }
  }, [stocks]);

  const { data: watchlist } = useGetWatchlist();
  const { data: expertPicks } = useGetExpertPicks();
  const { mutate: addWatch } = useAddToWatchlist();
  const { mutate: removeWatch } = useRemoveFromWatchlist();
  
  const { openTrade } = useTrade();
  const queryClient = useQueryClient();

  const toggleWatchlist = (e: React.MouseEvent, symbol: string, isWatched: boolean) => {
    e.stopPropagation();
    const onSuccess = () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
    if (isWatched) {
      removeWatch({ symbol }, { onSuccess });
    } else {
      addWatch({ data: { symbol } }, { onSuccess });
    }
  };

  // Fiyat formatı: emtia hesabında USD, normal hesapta TRY
  const fmtPrice = (price: number) => isMetalAccount ? fmtUsd(price) : formatCurrency(price);
  const fmtChange = (change: number) => isMetalAccount ? fmtUsd(Math.abs(change)) : formatCurrency(Math.abs(change));

  const filterButtons: { id: FilterType; label: string; color?: string }[] = [
    { id: "all", label: "Tümü" },
    { id: "gainers", label: "Yükselenler", color: "text-success" },
    { id: "losers", label: "Düşenler", color: "text-destructive" },
    { id: "most_volume", label: "En Çok Hacim" },
    { id: "watchlist", label: "Favorilerim" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* Emtia hesabı: 4 enstrüman banner */}
      {isMetalAccount && (
        <div className="rounded-2xl p-4 border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 dark:border-amber-700/40">
          <div className="flex items-center gap-3">
            <Gem className="w-6 h-6 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-200">Değerli Metaller & Emtia</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Bu hesapta yalnızca Altın (XAUTRYG), Gümüş (XAGTRYG), Brent Ham Petrol (BRENTOIL) ve WTI Ham Petrol (WTIOIL) işlemi yapabilirsiniz. Fiyatlar USD cinsinden. 7/24 açık piyasa.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isMetalAccount && expertPicks && expertPicks.length > 0 && (
        <div className="bg-card rounded-2xl p-4 md:p-6 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-display font-bold">Uzman Görüşü — Gözde Hisseler</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {expertPicks.map((pick) => {
              const isUp = (pick.change ?? 0) >= 0;
              return (
                <div
                  key={pick.id}
                  onClick={() => openTrade({ symbol: pick.symbol, name: pick.stockName ?? pick.symbol, price: pick.price ?? 0, change: pick.change ?? 0, changePercent: pick.changePercent ?? 0, volume: 0 })}
                  className={`p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
                    isUp ? 'bg-success/5 border-success/20 hover:border-success/40' : 'bg-destructive/5 border-destructive/20 hover:border-destructive/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {pick.logoUrl && (
                      <img
                        src={`/api/image?path=${encodeURIComponent(pick.logoUrl)}`}
                        alt={pick.symbol}
                        className="w-7 h-7 rounded-md object-cover border border-border flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm">{METAL_DISPLAY_SYMBOL[pick.symbol] ?? pick.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{pick.stockName}</div>
                    </div>
                  </div>
                  <div className="font-bold mt-1">{formatCurrency(pick.price ?? 0)}</div>
                  <div className={`text-xs font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
                    {isUp ? '+' : ''}{formatPercent(pick.changePercent ?? 0)}
                  </div>
                  {pick.note && <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{pick.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Arama + görünüm ayarları — emtia hesabında sadeleştirilmiş */}
      {!isMetalAccount && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-2xl shadow-sm border border-border">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Hisse kodu veya şirket adı ile ara..." 
              className="pl-10 bg-secondary/5 border-none h-12 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("list")} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/10'}`}>
              <List className="w-5 h-5" />
            </button>
            <button onClick={() => setView("grid")} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/10'}`}>
              <LayoutGrid className="w-5 h-5" />
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className="ml-2 px-3 py-2 h-10 bg-secondary/10 border-none text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="default">Varsayılan Sıra</option>
              <option value="price_desc">Fiyat (Yüksek → Düşük)</option>
              <option value="price_asc">Fiyat (Düşük → Yüksek)</option>
              <option value="change_desc">Değişim (Artış)</option>
              <option value="change_asc">Değişim (Düşüş)</option>
              <option value="volume_desc">Hacim (Yüksek)</option>
            </select>
          </div>
        </div>
      )}

      {!isMetalAccount && (
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border border-border hover:border-primary/40 hover:text-primary"
              } ${activeFilter !== f.id && f.color ? f.color : ""}`}
            >
              {f.id === "watchlist" && <Star className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {f.id === "gainers" && <TrendingUp className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {f.id === "losers" && <TrendingDown className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground flex items-center">
            {stocks?.length || 0} hisse listelendi
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 opacity-50 pointer-events-none">
           {[...Array(isMetalAccount ? 4 : 5)].map((_,i)=><div key={i} className="h-20 bg-card rounded-xl animate-pulse"/>)}
        </div>
      ) : stocks?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Sonuç bulunamadı</p>
          <p className="text-sm mt-1">Filtreleri değiştirerek tekrar deneyin</p>
        </div>
      ) : (
        <div className={
          isMetalAccount
            ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
            : view === "list" ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        }>
          {stocks?.map((stock) => {
            const isUp = stock.change >= 0;
            const isWatched = watchlist?.includes(stock.symbol);
            const flash = flashMap.get(stock.symbol);
            const metalLabel = METAL_LABELS[stock.symbol.toUpperCase()];

            // Emtia hesabı: kart görünümü (daima)
            if (isMetalAccount) {
              return (
                <div
                  key={stock.symbol}
                  onClick={() => openTrade(stock)}
                  className={`p-5 rounded-2xl border bg-card cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] relative overflow-hidden group ${
                    isUp ? "border-success/30 hover:border-success/60" : "border-destructive/30 hover:border-destructive/60"
                  } ${flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : ""}`}
                >
                  {/* Header: icon + symbol + USD badge */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Gem className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div>
                        <h3 className="font-display font-bold text-base leading-tight">{METAL_DISPLAY_SYMBOL[stock.symbol] ?? stock.symbol}</h3>
                        <p className="text-xs text-muted-foreground">{metalLabel || stock.name}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">USD</span>
                  </div>

                  {/* Body: price + chart */}
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-2xl mb-1 tabular-nums">{fmtPrice(stock.price)}</div>
                      <div className={`text-sm font-medium flex items-center ${isUp ? 'text-success' : 'text-destructive'}`}>
                        {isUp ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                        {isUp ? "+" : "-"}{fmtChange(stock.change)} ({formatPercent(stock.changePercent)})
                      </div>
                    </div>
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <MetalMiniChart symbol={stock.symbol} isUp={isUp} />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/50 flex justify-end items-center">
                    <span className="text-xs font-medium text-primary">İşlem Yap →</span>
                  </div>
                </div>
              );
            }

            // Normal hesap: liste veya kart görünümü
            const isTradeable = (stock as any).tradeable !== false;

            if (view === "list") {
              return (
                <div 
                  key={stock.symbol} 
                  data-testid={`stock-row-${stock.symbol}`}
                  onClick={() => isTradeable && openTrade(stock)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card transition-colors ${
                    isTradeable ? "cursor-pointer hover:bg-accent/40 hover:shadow-sm" : "opacity-60 cursor-not-allowed"
                  } ${flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button 
                      onClick={(e) => toggleWatchlist(e, stock.symbol, !!isWatched)}
                      className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${isWatched ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-secondary/20'}`}
                    >
                      <Star className={`w-4 h-4 ${isWatched ? 'fill-primary' : ''}`} />
                    </button>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm truncate">{stock.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{stock.name}</div>
                    </div>
                  </div>
                  
                  {isTradeable ? (
                    <>
                      <div className="hidden md:block px-4 flex-1 text-center text-xs text-muted-foreground">
                        Hacim: <span className="font-medium text-foreground">{formatNumber(stock.volume)}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-sm">{fmtPrice(stock.price)}</div>
                        <div className={`text-xs font-semibold flex items-center justify-end ${isUp ? 'text-success' : 'text-destructive'}`}>
                          {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                          {formatPercent(stock.changePercent)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex-shrink-0">
                      İşlem Kapalı
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div 
                key={stock.symbol} 
                onClick={() => isTradeable && openTrade(stock)}
                className={`p-5 rounded-2xl border border-border bg-card transition-colors relative overflow-hidden group ${
                  isTradeable
                    ? "cursor-pointer hover:shadow-lg hover:bg-accent/30"
                    : "opacity-60 cursor-not-allowed"
                } ${flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : ""}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display font-bold text-xl">{stock.symbol}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{stock.name}</p>
                  </div>
                  <button 
                    onClick={(e) => toggleWatchlist(e, stock.symbol, !!isWatched)}
                    className={`z-10 p-1.5 rounded-full transition-colors ${isWatched ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary/20'}`}
                  >
                    <Star className={`w-5 h-5 ${isWatched ? 'fill-primary' : ''}`} />
                  </button>
                </div>
                
                <div className="mt-6">
                  {isTradeable ? (
                    <>
                      <div className="font-bold text-2xl mb-1">{fmtPrice(stock.price)}</div>
                      <div className={`text-sm font-medium flex items-center ${isUp ? 'text-success' : 'text-destructive'}`}>
                        {isUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {fmtChange(stock.change)} ({formatPercent(stock.changePercent)})
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Hacim: {formatNumber(stock.volume)}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
                      İşlem Kapalı
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
