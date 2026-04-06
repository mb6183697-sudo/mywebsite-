import { useState, useEffect } from "react";
import { useGetPortfolio, useGetOrders, useCloseOrder } from "@workspace/api-client-react";
import { formatCurrency, formatPercent, formatDateTime } from "@/lib/utils";
import { Wallet, PieChart, Activity, Clock, RefreshCw, History, X, TrendingUp, TrendingDown, Calendar, Hash, BarChart2, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPortfolioQueryKey, getGetOrdersQueryKey } from "@workspace/api-client-react";

const METAL_DISPLAY: Record<string, string> = { XAUTRYG: "XAUUSD", XAGTRYG: "XAGUSD" };
const displaySym = (s: string) => METAL_DISPLAY[s?.toUpperCase?.()] ?? s;

interface Position {
  id: number; symbol: string; stockName: string; direction: string;
  lots: number; openPrice: number; currentPrice: number; closePrice: number;
  totalCost: number; currentValue: number; profitLoss: number;
  profitLossPercent: number; spreadAdjustment: number; commissionAmount: number;
  status: string; openedAt: string; closedAt: string;
}

interface CloseResult {
  symbol: string; stockName: string; direction: string; lots: number;
  openPrice: number; closePrice: number; profitLoss: number;
  totalCost: number; closedAt: string;
}

interface TradeClosedInfo {
  symbol: string; stockName: string; direction: string; lots: number;
  openPrice: number; closePrice: number; profitLoss: number;
  totalCost: number; closedAt: string | null;
}

function PositionDetailDialog({ pos, onClose, onClosePosition, marketOpen, isUsd }: { pos: Position; onClose: () => void; onClosePosition: (id: number) => void; marketOpen: boolean; isUsd?: boolean }) {
  const isBuy = pos.direction === "buy";
  const isProfit = pos.profitLoss >= 0;
  const fmt = (n: number) => isUsd ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(n);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-3xl md:rounded-2xl w-full md:max-w-sm shadow-2xl flex flex-col" style={{ maxHeight: "calc(100vh - 16px)" }} onClick={e => e.stopPropagation()}>
        {/* Header — sabit */}
        <div className="flex items-start justify-between p-5 pb-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black font-display">{displaySym(pos.symbol)}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wide ${isBuy ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                {isBuy ? "ALIŞ" : "SATIŞ"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{pos.stockName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/40 transition-colors text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* İçerik — kaydırılabilir */}
        <div className="overflow-y-auto min-h-0 flex-1 px-5">
          <div className={`rounded-2xl p-4 mb-4 ${isProfit ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
            <p className="text-xs text-muted-foreground mb-1">Kar / Zarar</p>
            <p className={`text-3xl font-black ${isProfit ? "text-success" : "text-destructive"}`}>
              {isProfit ? "+" : ""}{fmt(pos.profitLoss)}
            </p>
            <p className={`text-sm font-bold ${isProfit ? "text-success" : "text-destructive"}`}>
              {formatPercent(pos.profitLossPercent)} getiri
            </p>
          </div>

          <div className="bg-secondary/20 rounded-xl p-4 space-y-2.5 mb-4">
            <DetailRow icon={<Hash className="w-4 h-4" />} label="Adet" value={`${pos.lots} lot`} />
            <DetailRow icon={<DollarSign className="w-4 h-4" />} label="Alış Fiyatı" value={fmt(pos.openPrice)} />
            <DetailRow icon={<TrendingUp className="w-4 h-4" />} label="Güncel Fiyat" value={fmt(pos.currentPrice)} highlight />
            <DetailRow icon={<BarChart2 className="w-4 h-4" />} label="Teminat" value={fmt(pos.totalCost)} />
            <DetailRow icon={<BarChart2 className="w-4 h-4" />} label="Güncel Değer" value={fmt(pos.currentValue)} />
            {pos.commissionAmount > 0 && (
              <DetailRow icon={<DollarSign className="w-4 h-4" />} label="Komisyon" value={fmt(pos.commissionAmount)} />
            )}
            <DetailRow icon={<Calendar className="w-4 h-4" />} label="Açılış Tarihi" value={formatDateTime(pos.openedAt)} />
          </div>
        </div>

        {/* Kapat butonu — her zaman altta sabit */}
        <div className="p-5 pt-3 flex-shrink-0 border-t border-border/50" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
          <Button
            variant="destructive"
            className="w-full h-12 font-bold text-base"
            disabled={!marketOpen}
            title={!marketOpen ? "Piyasa kapalı: Pazartesi–Cuma 10:00–18:00" : undefined}
            onClick={() => { onClosePosition(pos.id); onClose(); }}
          >
            {marketOpen ? "Pozisyonu Kapat" : "Piyasa Kapalı"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TradeClosedDialog({ info, onClose, isUsd }: { info: TradeClosedInfo; onClose: () => void; isUsd?: boolean }) {
  const isBuy = info.direction === "buy";
  const isProfit = info.profitLoss >= 0;
  const profitPct = info.totalCost > 0 ? (info.profitLoss / info.totalCost) * 100 : 0;
  const fmt = (n: number) => isUsd ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : formatCurrency(n);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isProfit ? "bg-success/15" : "bg-destructive/15"}`}>
              <CheckCircle2 className={`w-5 h-5 ${isProfit ? "text-success" : "text-destructive"}`} />
            </div>
            <div>
              <p className="font-black text-lg font-display leading-tight">{displaySym(info.symbol)}</p>
              <p className="text-xs text-muted-foreground leading-tight">{info.stockName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isBuy ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
              {isBuy ? "ALIŞ" : "SATIŞ"}
            </span>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* K/Z Banner */}
        <div className={`mx-4 mt-3 rounded-xl px-4 py-3 flex items-center justify-between ${isProfit ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Toplam K/Z</p>
            <p className={`text-2xl font-black ${isProfit ? "text-success" : "text-destructive"}`}>
              {isProfit ? "+" : ""}{fmt(info.profitLoss)}
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-sm font-black ${isProfit ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
            {profitPct > 0 ? "+" : ""}{profitPct.toFixed(2)}%
          </div>
        </div>

        {/* Details Grid */}
        <div className="px-4 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Adet</p>
              <p className="text-sm font-bold">{info.lots} lot</p>
            </div>
            <div className="bg-secondary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Maliyet</p>
              <p className="text-sm font-bold">{fmt(info.totalCost)}</p>
            </div>
            <div className="bg-secondary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Alış Fiyatı</p>
              <p className="text-sm font-bold">{fmt(info.openPrice)}</p>
            </div>
            <div className="bg-secondary/20 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-0.5">Satış Fiyatı</p>
              <p className="text-sm font-bold">{fmt(info.closePrice)}</p>
            </div>
          </div>
          {info.closedAt && (
            <p className="text-xs text-muted-foreground text-center">
              Kapanış: {formatDateTime(info.closedAt)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <Button onClick={onClose} className="w-full h-10 font-bold">Tamam</Button>
        </div>
      </div>
    </div>
  );
}

function CloseResultDialog({ result, onClose, isUsd }: { result: CloseResult; onClose: () => void; isUsd?: boolean }) {
  return (
    <TradeClosedDialog
      isUsd={isUsd}
      info={{
        symbol: result.symbol,
        stockName: result.stockName,
        direction: result.direction,
        lots: result.lots,
        openPrice: result.openPrice,
        closePrice: result.closePrice,
        profitLoss: result.profitLoss,
        totalCost: result.totalCost,
        closedAt: result.closedAt,
      }}
      onClose={onClose}
    />
  );
}

function ClosedOrderDetailDialog({ order, onClose, isUsd }: { order: any; onClose: () => void; isUsd?: boolean }) {
  const openPrice = order.openPrice ?? 0;
  const lots = order.lots ?? 0;
  return (
    <TradeClosedDialog
      isUsd={isUsd}
      info={{
        symbol: order.symbol,
        stockName: order.stockName,
        direction: order.direction,
        lots,
        openPrice,
        closePrice: order.closePrice ?? 0,
        profitLoss: order.profitLoss ?? 0,
        totalCost: openPrice * lots,
        closedAt: order.closedAt ?? null,
      }}
      onClose={onClose}
    />
  );
}

function DetailRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm font-bold ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

/** Şu anki saatin piyasa saatleri içinde olup olmadığını hesaplar (Türkiye saati, Pzt-Cum 10:00-18:00) */
function calcMarketOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const dow = ist.getDay();
  const min = ist.getHours() * 60 + ist.getMinutes();
  return dow >= 1 && dow <= 5 && min >= 600 && min < 1080; // 10:00–18:00
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const { data: portfolio, isLoading: isPortLoading } = useGetPortfolio({ query: { refetchInterval: 2000 } });
  const { data: orders, isLoading: isOrdersLoading } = useGetOrders({ status: "open" }, { query: { refetchInterval: 1000 } });
  const { data: closedOrders } = useGetOrders({ status: "closed" }, { query: { refetchInterval: 3000 } });
  
  const { mutate: closePos } = useCloseOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [marketOpen, setMarketOpen] = useState(calcMarketOpen);
  useEffect(() => {
    const tick = () => setMarketOpen(calcMarketOpen());
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const handleClose = (id: number) => {
    const pos = portfolio?.positions.find(p => p.id === id);
    closePos({ id }, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
        if (pos) {
          setCloseResult({
            symbol: pos.symbol,
            stockName: pos.stockName,
            direction: pos.direction,
            lots: pos.lots,
            openPrice: pos.openPrice,
            closePrice: data?.closePrice || pos.currentPrice,
            profitLoss: data?.profitLoss ?? pos.profitLoss,
            totalCost: pos.totalCost,
            closedAt: data?.closedAt || new Date().toISOString(),
          });
        }
      },
      onError: (err) => {
        toast({ title: "Hata", description: err.message, variant: "destructive" });
      }
    });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'filled': return { text: 'Gerçekleşti', cls: 'bg-success/20 text-success' };
      case 'closed': return { text: 'Kapatıldı', cls: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' };
      case 'cancelled': return { text: 'İptal Edildi', cls: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' };
      default: return { text: status, cls: 'bg-secondary/20 text-foreground' };
    }
  };

  const isLeveraged = (portfolio as any)?.isLeveraged === true;
  const balanceCurrency: string = (portfolio as any)?.balanceCurrency ?? "TRY";
  const isUsd = balanceCurrency === "USD";
  const marginLevel: number | null = (portfolio as any)?.marginLevel ?? null;
  const marginCallWarning = isLeveraged && marginLevel !== null && marginLevel < 100;
  const canClosePosition = isLeveraged || marketOpen; // metal hesaplar 24/7 işlem yapabilir

  // Currency-aware formatter
  const fmt = (n: number) => isUsd
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatCurrency(n);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* Margin Call uyarısı (kaldıraçlı hesaplar için) */}
      {marginCallWarning && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-destructive border border-destructive text-white text-sm font-medium shadow-lg">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-base">⚠️ Teminat Çağrısı (Margin Call)</p>
            <p className="text-white/90 mt-1">
              Teminat seviyeniz <strong>%{marginLevel?.toFixed(0)}</strong> — kritik eşiğin altına düştü.
              Pozisyonlarınız otomatik kapatılabilir. Lütfen teminat yatırın veya pozisyon kapatın.
            </p>
          </div>
        </div>
      )}

      {/* Piyasa kapalı uyarısı (sadece spot hesaplar için) */}
      {!marketOpen && !isLeveraged && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Piyasa şu anda kapalı. İşlem açma ve kapatma yalnızca <strong>Pazartesi–Cuma 10:00–18:00</strong> (Türkiye saati) arasında mümkündür.</span>
        </div>
      )}

      {/* Metal/Kaldıraçlı hesap metrikleri */}
      {isLeveraged ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* Equity = nakit + yüzen K/Z */}
          <div className="bg-card p-4 md:p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs md:text-sm font-medium">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Varlık (Equity)
            </div>
            <div className="text-lg md:text-2xl font-bold">{fmt((portfolio as any)?.equity ?? portfolio?.totalBalance ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">Nakit + K/Z</div>
          </div>

          {/* Kullanılan Teminat */}
          <div className="bg-amber-500/10 dark:bg-amber-500/20 p-4 md:p-6 rounded-2xl shadow-sm border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2 text-xs md:text-sm font-medium">
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5" /> Kullanılan Teminat
            </div>
            <div className="text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-100">
              {fmt((portfolio as any)?.usedMargin ?? 0)}
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 opacity-80">Açık pozisyonlar için</div>
          </div>

          {/* Serbest Teminat */}
          <div className="bg-card p-4 md:p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs md:text-sm font-medium">
              <PieChart className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Serbest Teminat
            </div>
            <div className="text-lg md:text-2xl font-bold">{fmt((portfolio as any)?.freeMargin ?? portfolio?.availableBalance ?? 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">İşlem için kullanılabilir</div>
          </div>

          {/* Teminat Seviyesi */}
          <div className={`p-4 md:p-6 rounded-2xl shadow-sm border ${
            marginLevel === null ? "bg-card border-border" :
            marginLevel >= 200 ? "bg-success/10 border-success/20" :
            marginLevel >= 100 ? "bg-amber-500/10 border-amber-500/20" :
            "bg-destructive/10 border-destructive/20"
          }`}>
            <div className={`flex items-center gap-2 mb-2 text-xs md:text-sm font-medium ${
              marginLevel === null ? "text-muted-foreground" :
              marginLevel >= 200 ? "text-success" :
              marginLevel >= 100 ? "text-amber-600" :
              "text-destructive"
            }`}>
              <Activity className="w-4 h-4 md:w-5 md:h-5" /> Teminat Seviyesi
            </div>
            <div className={`text-lg md:text-2xl font-bold ${
              marginLevel === null ? "text-foreground" :
              marginLevel >= 200 ? "text-success" :
              marginLevel >= 100 ? "text-amber-600" :
              "text-destructive"
            }`}>
              {marginLevel !== null ? `%${marginLevel.toFixed(0)}` : "—"}
            </div>
            {marginLevel !== null && (
              <div className="text-xs mt-1 opacity-80">
                {marginLevel >= 200 ? "Güvenli" : marginLevel >= 100 ? "Dikkat" : "Kritik — Teminat Çağrısı!"}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Spot (BIST) hesap metrikleri */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* Bakiye = Kilitli + Kullanılabilir */}
          <div className="bg-card p-4 md:p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs md:text-sm font-medium">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Bakiye
            </div>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(portfolio?.totalBalance ?? portfolio?.totalValue)}</div>
            <div className="text-xs text-muted-foreground mt-1 opacity-70">Kilitli + Kullanılabilir</div>
          </div>
          
          {/* Kilitli = açık pozisyonların anlık piyasa değeri */}
          <div className="bg-amber-500/10 dark:bg-amber-500/20 p-4 md:p-6 rounded-2xl shadow-sm border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2 text-xs md:text-sm font-medium">
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5" /> Kilitli
            </div>
            <div className="text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-100">
              {formatCurrency(portfolio?.lockedBalance ?? 0)}
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 opacity-80">
              {(portfolio?.t2Balance ?? 0) > 0
                ? `Açık poz. değeri · T+2: ${formatCurrency(portfolio?.t2Balance)}`
                : "Açık poz. piyasa değeri"}
            </div>
          </div>

          {/* Kullanılabilir = mevcut nakit */}
          <div className="bg-card p-4 md:p-6 rounded-2xl shadow-sm border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 text-xs md:text-sm font-medium">
              <PieChart className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Kullanılabilir
            </div>
            <div className="text-lg md:text-2xl font-bold">{formatCurrency(portfolio?.availableBalance)}</div>
            <div className="text-xs text-muted-foreground mt-1 opacity-70">Mevcut nakit</div>
          </div>

          {/* Kar/Zarar = açık pozisyonların anlık K/Z */}
          <div className={`p-4 md:p-6 rounded-2xl shadow-sm border ${
            (portfolio?.profitLoss ?? 0) >= 0 ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'
          }`}>
            <div className={`flex items-center gap-2 mb-2 text-xs md:text-sm font-medium ${
              (portfolio?.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              <Activity className="w-4 h-4 md:w-5 md:h-5" /> K/Z
            </div>
            <div className={`text-lg md:text-2xl font-bold ${(portfolio?.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {(portfolio?.profitLoss ?? 0) > 0 ? "+" : ""}{formatCurrency(portfolio?.profitLoss)}
              <span className="text-xs ml-1 opacity-80">({formatPercent(portfolio?.profitLossPercent)})</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="flex border-b border-border bg-secondary/5">
          <button
            onClick={() => setTab("positions")}
            className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold transition-all ${
              tab === "positions" ? "text-primary border-b-2 border-primary bg-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Açık Pozisyonlar
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold transition-all ${
              tab === "orders" ? "text-primary border-b-2 border-primary bg-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bekleyen Emirler
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-3 md:py-4 text-xs md:text-sm font-bold transition-all ${
              tab === "history" ? "text-primary border-b-2 border-primary bg-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5 inline mr-1 -mt-0.5 md:hidden" />
            İşlem Geçmişi
          </button>
        </div>

        <div className="p-0 overflow-x-auto">
          {tab === "positions" && (
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/10 text-muted-foreground font-medium border-b border-border">
                <tr>
                  <th className="px-4 md:px-6 py-3 md:py-4">Hisse</th>
                  <th className="px-4 md:px-6 py-3 md:py-4">Yön</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right">Adet</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right hidden md:table-cell">Maliyet</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right">Güncel</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right">K/Z</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {portfolio?.positions.map((pos) => {
                  const isProfit = pos.profitLoss >= 0;
                  return (
                    <tr
                      key={pos.id}
                      onClick={() => setSelectedPosition(pos as any)}
                      className="hover:bg-secondary/5 transition-colors cursor-pointer"
                    >
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <p className="font-bold font-display">{displaySym(pos.symbol)}</p>
                        <p className="text-xs text-muted-foreground hidden md:block truncate max-w-[100px]">{pos.stockName}</p>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${pos.direction === 'buy' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                          {pos.direction === 'buy' ? 'AL' : 'SAT'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right font-medium">{pos.lots}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right hidden md:table-cell">{fmt(pos.openPrice)}</td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right font-bold">{fmt(pos.currentPrice)}</td>
                      <td className={`px-4 md:px-6 py-3 md:py-4 text-right font-bold ${isProfit ? 'text-success' : 'text-destructive'}`}>
                        {fmt(pos.profitLoss)}
                        <div className="text-xs font-medium">{formatPercent(pos.profitLossPercent)}</div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-center" onClick={e => e.stopPropagation()}>
                        <Button
                          onClick={() => handleClose(pos.id)}
                          size="sm"
                          variant="outline"
                          disabled={!canClosePosition}
                          title={!canClosePosition ? "Piyasa kapalı: Pazartesi–Cuma 10:00–18:00" : undefined}
                          className="h-8 text-xs"
                        >Kapat</Button>
                      </td>
                    </tr>
                  )
                })}
                {portfolio?.positions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Açık pozisyonunuz bulunmuyor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "orders" && (
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/10 text-muted-foreground font-medium border-b border-border">
                <tr>
                  <th className="px-4 md:px-6 py-3 md:py-4">Tarih</th>
                  <th className="px-4 md:px-6 py-3 md:py-4">Hisse</th>
                  <th className="px-4 md:px-6 py-3 md:py-4">Tip / Yön</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right">Adet</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right">Fiyat</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders?.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary/5 transition-colors">
                    <td className="px-4 md:px-6 py-3 md:py-4 text-muted-foreground text-xs md:text-sm">
                      <Clock className="w-3.5 h-3.5 inline mr-1" /> {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 font-bold font-display">{displaySym(order.symbol)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs uppercase border border-border px-1.5 rounded">{order.type}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.direction === 'buy' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                          {order.direction === 'buy' ? 'AL' : 'SAT'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right font-medium">{order.lots}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">{order.limitPrice ? fmt(order.limitPrice) : 'Piyasa'}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
                        Bekliyor
                      </span>
                    </td>
                  </tr>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Bekleyen emriniz bulunmuyor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "history" && (
            <div className="divide-y divide-border">
              {[...(closedOrders ?? [])].sort((a, b) => {
                const aT = new Date(a.closedAt || a.createdAt || 0).getTime();
                const bT = new Date(b.closedAt || b.createdAt || 0).getTime();
                return bT - aT;
              }).map((order) => {
                const isProfit = (order.profitLoss ?? 0) >= 0;
                const isBuy = order.direction === "buy";
                const closedDate = order.closedAt || order.createdAt;
                const dateObj = closedDate ? new Date(closedDate) : null;
                const dateStr = dateObj
                  ? dateObj.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })
                  : "—";
                const timeStr = dateObj
                  ? dateObj.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <button
                    key={order.id}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/10 active:bg-secondary/20 transition-colors text-left"
                    onClick={() => setSelectedHistory(order)}
                  >
                    {/* Direction dot */}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black ${isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {isBuy ? "AL" : "SAT"}
                    </div>

                    {/* Symbol + date */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-tight">{displaySym(order.symbol)}
                        <span className="text-muted-foreground font-normal text-xs ml-1.5">{order.lots} adet</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{dateStr} {timeStr}</p>
                    </div>

                    {/* P&L */}
                    <div className="text-right flex-shrink-0">
                      {order.profitLoss != null ? (
                        <p className={`text-sm font-black ${isProfit ? "text-success" : "text-destructive"}`}>
                          {isProfit ? "+" : ""}{fmt(order.profitLoss)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">›</p>
                    </div>
                  </button>
                );
              })}
              {(!closedOrders || closedOrders.length === 0) && (
                <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                  Geçmiş işleminiz bulunmuyor.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedPosition && (
        <PositionDetailDialog
          pos={selectedPosition}
          marketOpen={canClosePosition}
          isUsd={isUsd}
          onClose={() => setSelectedPosition(null)}
          onClosePosition={(id) => { setSelectedPosition(null); handleClose(id); }}
        />
      )}

      {closeResult && (
        <CloseResultDialog
          result={closeResult}
          isUsd={isUsd}
          onClose={() => setCloseResult(null)}
        />
      )}

      {selectedHistory && (
        <ClosedOrderDetailDialog
          order={selectedHistory}
          isUsd={isUsd}
          onClose={() => setSelectedHistory(null)}
        />
      )}
    </div>
  );
}
