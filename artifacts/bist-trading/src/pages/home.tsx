import { useGetMarketSummary, useGetTopMovers, useGetWatchlist, useGetStocks } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Star, TrendingDown, TrendingUp, Globe } from "lucide-react";
import { useTrade } from "@/hooks/use-trade";
import { Link } from "wouter";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

type ForexRate = { symbol: string; name: string; price: number; change: number; changePercent: number; sparkline?: number[] };

function useForexRates() {
  return useQuery<ForexRate[]>({
    queryKey: ["forex"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/forex`);
      if (!res.ok) throw new Error("forex fetch failed");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30_000,
    staleTime: 0,
    retry: 3,
    retryDelay: 2000,
  });
}

function fmtForex(price: number, symbol: string) {
  const isTRY = symbol.endsWith("TRY");
  return isTRY
    ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(price)
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 5 }).format(price);
}

const METAL_SYMBOLS = ["XAUTRYG", "XAGTRYG", "BRENTOIL", "WTIOIL"];

function MiniSparkline({ data, isUp }: { data: number[]; isUp: boolean }) {
  if (!data || data.length < 2) {
    return <div className="h-8 w-full" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 64, H = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color = isUp ? "#22c55e" : "#ef4444";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Gradient area fill */}
      <defs>
        <linearGradient id={`sg-${isUp ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#sg-${isUp ? "u" : "d"})`} />
    </svg>
  );
}

function ForexWidget() {
  const { data: rates } = useForexRates();

  return (
    <div className="bg-card rounded-2xl px-5 py-4 shadow-md border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-primary" />
        <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">Döviz Kurları</span>
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground text-xs">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Canlı
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {(rates && rates.length > 0) ? rates.map(rate => {
          const isUp = rate.changePercent >= 0;
          return (
            <div key={rate.symbol} className={`rounded-xl p-3 relative overflow-hidden border ${isUp ? "bg-success/5 border-success/15" : "bg-destructive/5 border-destructive/15"}`}>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{rate.symbol}</div>
              <div className="font-bold text-sm tabular-nums">{rate.price > 0 ? fmtForex(rate.price, rate.symbol) : "—"}</div>
              <div className={`text-xs font-semibold flex items-center gap-0.5 mt-0.5 ${isUp ? "text-success" : "text-destructive"}`}>
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {formatPercent(Math.abs(rate.changePercent))}
              </div>
              <div className="mt-1.5">
                <MiniSparkline data={rate.sparkline ?? [rate.price]} isUp={isUp} />
              </div>
            </div>
          );
        }) : Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-secondary/10 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const isMetalAccount = !!(user as any)?.isMetalAccount;

  const { data: summary } = useGetMarketSummary();
  const { data: movers } = useGetTopMovers();
  const { data: watchlistSymbols } = useGetWatchlist();
  const { data: stocks } = useGetStocks();
  const { openTrade } = useTrade();

  // For metal accounts: show all 4 metal stocks; for others: show watchlist
  const metalStocks = stocks?.filter(s => METAL_SYMBOLS.includes(s.symbol)) ?? [];
  const watchlist = stocks?.filter(s => watchlistSymbols?.includes(s.symbol)) ?? [];

  const displayStocks = isMetalAccount ? metalStocks : watchlist;

  const prevPricesRef = useRef<Record<string, number>>({});
  const [flashMap, setFlashMap] = useState<Record<string, "up" | "down">>({});

  useEffect(() => {
    if (!displayStocks.length) return undefined;
    const newFlash: Record<string, "up" | "down"> = {};
    displayStocks.forEach(s => {
      const prev = prevPricesRef.current[s.symbol];
      if (prev !== undefined && prev !== s.price) {
        newFlash[s.symbol] = s.price > prev ? "up" : "down";
      }
      prevPricesRef.current[s.symbol] = s.price;
    });
    if (Object.keys(newFlash).length > 0) {
      setFlashMap(newFlash);
      const t = setTimeout(() => setFlashMap({}), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [displayStocks.map(s => s.price).join(",")]);

  const g = summary?.gainersPercent ?? 0;
  const l = summary?.losersPercent ?? 0;
  const total = g + l || 1;
  const gPct = Math.round((g / total) * 100);
  const lPct = 100 - gPct;

  const fmtPrice = (price: number) => isMetalAccount
    ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatCurrency(price);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {isMetalAccount ? (
        <ForexWidget />
      ) : (
        <div className="bg-card rounded-2xl px-5 py-4 shadow-md border border-border/50 flex flex-wrap items-center gap-x-8 gap-y-3">
          {/* BIST 100 */}
          <div className="flex items-center gap-4 min-w-[160px]">
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-0.5">BIST 100 Endeksi</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums">{formatCurrency(summary?.xu100?.price)}</span>
                <span className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  (summary?.xu100?.changePercent ?? 0) >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {(summary?.xu100?.changePercent ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {formatPercent(summary?.xu100?.changePercent)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-px h-8 bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${summary?.isOpen ? 'bg-success' : 'bg-destructive'}`} />
              {summary?.isOpen ? 'Piyasa Açık' : 'Piyasa Kapalı'}
            </span>
            <span className="text-muted-foreground hidden sm:inline">Hacim: <span className="font-medium text-foreground">{formatCurrency(summary?.totalVolume)}</span></span>
          </div>

          <div className="w-px h-8 bg-border/60 hidden md:block" />

          <div className="flex-1 min-w-[200px]">
            <div className="flex justify-between text-[11px] font-bold mb-1.5">
              <span className="text-success flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Yükselenler</span>
              <span className="text-destructive flex items-center gap-0.5">Düşenler <TrendingDown className="w-3 h-3" /></span>
            </div>
            <div className="flex h-7 rounded-full overflow-hidden">
              <div style={{ width: `${gPct}%` }} className="bg-success flex items-center justify-center text-white text-xs font-black transition-all duration-1000">
                {gPct > 12 ? `${gPct}%` : ""}
              </div>
              <div style={{ width: `${lPct}%` }} className="bg-destructive flex items-center justify-center text-white text-xs font-black transition-all duration-1000">
                {lPct > 12 ? `${lPct}%` : ""}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Watchlist / Metal instruments */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-primary fill-primary/20" />
              {isMetalAccount ? "Emtia Araçları" : "İzleme Listem"}
            </h2>
            {!isMetalAccount && <Link href="/hisseler" className="text-primary text-sm font-medium hover:underline">Tümünü Gör</Link>}
          </div>
          
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            {displayStocks.length > 0 ? displayStocks.map((stock, i) => {
              const isUp = stock.change >= 0;
              const flash = flashMap[stock.symbol];
              return (
                <div
                  key={stock.symbol}
                  onClick={() => openTrade(stock)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-300 hover:bg-secondary/10 ${i > 0 ? "border-t border-border/50" : ""} ${flash === "up" ? "bg-success/10" : flash === "down" ? "bg-destructive/10" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm">{isMetalAccount ? stock.name : stock.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {isMetalAccount
                        ? ({ XAUTRYG: "XAUUSD", XAGTRYG: "XAGUSD" } as Record<string,string>)[stock.symbol] ?? stock.symbol
                        : stock.name}
                    </div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className={`font-bold text-sm transition-colors duration-300 ${flash === "up" ? "text-success" : flash === "down" ? "text-destructive" : "text-foreground"}`}>
                      {fmtPrice(stock.price)}
                    </div>
                    <div className={`text-xs font-semibold flex items-center justify-end ${isUp ? "text-success" : "text-destructive"}`}>
                      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {formatPercent(stock.changePercent)}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="py-12 text-center">
                <Star className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                {isMetalAccount ? (
                  <p className="text-muted-foreground text-sm">Fiyatlar yükleniyor...</p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm">İzleme listeniz boş.</p>
                    <Link href="/hisseler" className="text-primary font-medium mt-1 inline-block text-sm hover:underline">Hisse Ekle</Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Movers Sidebar — only for normal accounts */}
        {!isMetalAccount && (
          <div className="space-y-8">
            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
              <div className="bg-success/10 p-4 border-b border-border">
                <h3 className="font-bold text-success flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> En Çok Yükselenler
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                {movers?.gainers.slice(0, 5).map(stock => (
                  <div key={stock.symbol} onClick={() => openTrade(stock)} className="p-4 flex items-center justify-between hover:bg-secondary/5 cursor-pointer transition-colors">
                    <div className="font-bold">{stock.symbol}</div>
                    <div className="text-right">
                      <div>{formatCurrency(stock.price)}</div>
                      <div className="text-success text-sm font-medium">+{formatPercent(stock.changePercent)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
              <div className="bg-destructive/10 p-4 border-b border-border">
                <h3 className="font-bold text-destructive flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" /> En Çok Düşenler
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                {movers?.losers.slice(0, 5).map(stock => (
                  <div key={stock.symbol} onClick={() => openTrade(stock)} className="p-4 flex items-center justify-between hover:bg-secondary/5 cursor-pointer transition-colors">
                    <div className="font-bold">{stock.symbol}</div>
                    <div className="text-right">
                      <div>{formatCurrency(stock.price)}</div>
                      <div className="text-destructive text-sm font-medium">{formatPercent(stock.changePercent)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
