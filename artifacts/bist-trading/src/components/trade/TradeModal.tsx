import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Stock, useCreateOrder, useGetMe } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, AlertCircle, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOrdersQueryKey, getGetPortfolioQueryKey } from "@workspace/api-client-react";
import StockChart from "./StockChart";

const METAL_SYMBOLS = new Set(["XAUTRYG", "XAGTRYG", "BRENTOIL", "WTIOIL"]);
const METAL_DISPLAY: Record<string, string> = { XAUTRYG: "XAUUSD", XAGTRYG: "XAGUSD" };
const displaySym = (s: string) => METAL_DISPLAY[s?.toUpperCase?.()] ?? s;

// Sözleşme büyüklükleri (1 lot = kaç birim)
const CONTRACT_SIZES: Record<string, number> = {
  XAUTRYG: 100,   // Altın: 100 troy oz/lot
  XAGTRYG: 5000,  // Gümüş: 5000 troy oz/lot
  BRENTOIL: 1000, // Brent Ham Petrol: 1000 varil/lot
  WTIOIL: 1000,   // WTI Ham Petrol: 1000 varil/lot
};
const CONTRACT_UNITS: Record<string, string> = {
  XAUTRYG: "troy oz", XAGTRYG: "troy oz", BRENTOIL: "varil", WTIOIL: "varil",
};

interface TradeModalProps {
  stock: Stock;
  onClose: () => void;
}

function calcMarketOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const dow = ist.getDay();
  const min = ist.getHours() * 60 + ist.getMinutes();
  return dow >= 1 && dow <= 5 && min >= 600 && min < 1080;
}

export default function TradeModal({ stock, onClose }: TradeModalProps) {
  const [tab, setTab] = useState<"AL" | "SAT">("AL");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [lots, setLots] = useState<string>("");
  const [marketOpen, setMarketOpen] = useState(calcMarketOpen);
  useEffect(() => {
    const id = setInterval(() => setMarketOpen(calcMarketOpen()), 30_000);
    return () => clearInterval(id);
  }, []);
  const [limitPrice, setLimitPrice] = useState<string>(stock.price.toString());
  const [showChart, setShowChart] = useState(false);
  
  const { data: user } = useGetMe();
  const { mutate: createOrder, isPending } = useCreateOrder();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMetalSymbol = METAL_SYMBOLS.has(stock.symbol.toUpperCase());
  const isMetalAccount = !!(user as any)?.isMetalAccount;
  const isUsd = (user as any)?.balanceCurrency === "USD";
  const leverage = (user as any)?.leverage ?? null;
  // Metal accounts can trade 24/7, others only during market hours
  const canTrade = isMetalAccount ? true : marketOpen;

  // Initialize lot default based on account type
  useEffect(() => {
    setLots(isMetalAccount ? "0.01" : "1");
  }, [isMetalAccount]);

  const isUp = stock.change >= 0;
  const isVerified = user?.isIdentityVerified;

  // Parse lots: float for metal, integer for spot
  const parsedLots = isMetalAccount ? (Math.round(parseFloat(lots) * 100) / 100) || 0 : (parseInt(lots) || 0);
  const parsedPrice = orderType === "market" ? stock.price : (parseFloat(limitPrice) || stock.price);
  const contractSize = isMetalAccount ? (CONTRACT_SIZES[stock.symbol.toUpperCase()] ?? 1) : 1;
  const contractUnit = CONTRACT_UNITS[stock.symbol.toUpperCase()] ?? "";
  const notionalAmount = parsedLots * contractSize * parsedPrice; // lot × sözleşme büyüklüğü × fiyat
  const marginRequired = leverage ? notionalAmount / leverage : null;
  const totalAmount = marginRequired !== null ? marginRequired : notionalAmount;

  // Format currency based on account type
  const fmt = (n: number) => isUsd
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatCurrency(n);

  const handleSubmit = () => {
    if (parsedLots <= 0) return;
    
    createOrder({
      data: {
        symbol: stock.symbol,
        direction: tab === "AL" ? "buy" : "sell",
        type: orderType,
        lots: parsedLots,
        ...(orderType === "limit" ? { limitPrice: parsedPrice } : {})
      }
    }, {
      onSuccess: () => {
        toast({
          title: "İşlem Başarılı",
          description: `${parsedLots} lot ${displaySym(stock.symbol)} ${tab === "AL" ? "alındı" : "satıldı"}.`,
        });
        queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        onClose();
      },
      onError: (err) => {
        toast({
          title: "İşlem Başarısız",
          description: err.message || "Bilinmeyen bir hata oluştu.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <>
      {showChart && createPortal(
        <StockChart
          symbol={stock.symbol}
          name={stock.name}
          currentPrice={stock.price}
          changePercent={stock.changePercent}
          isUsd={isMetalAccount}
          onMinimize={() => setShowChart(false)}
        />,
        document.body
      )}
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="trade-modal" className="sm:max-w-[425px] p-0 overflow-y-auto max-h-[90vh] bg-card border-border rounded-2xl shadow-2xl">
        
        {/* Header Section */}
        <div className="bg-secondary/5 p-6 border-b border-border">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
                  {displaySym(stock.symbol)}
                  <span className={`text-sm px-2 py-0.5 rounded-full ${isUp ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {formatPercent(stock.changePercent)}
                  </span>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{stock.name}</p>
                {isMetalAccount && contractSize > 1 && (
                  <span className="inline-block mt-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    1 lot = {contractSize.toLocaleString()} {contractUnit}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setShowChart(true)}
                  title="Grafik Göster"
                  className="mt-1 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
                <div className="text-right">
                  <div className="text-2xl font-bold">{fmt(stock.price)}</div>
                  <div className={`text-sm flex items-center justify-end ${isUp ? 'text-success' : 'text-destructive'}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {fmt(stock.change)}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {!isVerified && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Kimlik onayınız bekleniyor.</strong> İşlem yapmak için profilinizden kimlik belgenizi yükleyin.
              </div>
            </div>
          )}

          {/* Action Tabs */}
          <div className="flex rounded-xl bg-secondary/10 p-1">
            <button
              onClick={() => setTab("AL")}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                tab === "AL" ? "bg-success text-success-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ALIŞ
            </button>
            <button
              onClick={() => setTab("SAT")}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                tab === "SAT" ? "bg-destructive text-destructive-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SATIŞ
            </button>
          </div>

          {/* Order Type Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setOrderType("market")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-all ${
                orderType === "market" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Piyasa
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-all ${
                orderType === "limit" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Limit
            </button>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-muted-foreground w-1/3">
                Hacim (Lot)
                {isMetalAccount && <span className="block text-xs text-muted-foreground/70">Min: 0.01</span>}
              </label>
              <div className="w-2/3 relative">
                <input
                  type="number"
                  min={isMetalAccount ? "0.01" : "1"}
                  step={isMetalAccount ? "0.01" : "1"}
                  value={lots}
                  onChange={(e) => setLots(e.target.value)}
                  className="w-full bg-background border-2 border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-right font-medium"
                />
              </div>
            </div>

            {orderType === "limit" && (
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-muted-foreground w-1/3">Limit Fiyat</label>
                <div className="w-2/3 relative">
                  <input
                    type="number"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-full bg-background border-2 border-border rounded-xl px-4 py-2 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-right font-medium"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{isUsd ? "$" : "₺"}</span>
                </div>
              </div>
            )}

            {/* Forex-style Notional + Margin display */}
            {isMetalAccount && parsedLots > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3 space-y-1.5">
                {contractSize > 1 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-amber-200 dark:border-amber-700/40">
                    <span>Hacim</span>
                    <span className="font-medium">{(parsedLots * contractSize).toLocaleString("en-US")} {contractUnit}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pozisyon Değeri</span>
                  <span className="font-medium">{fmt(notionalAmount)}</span>
                </div>
                {leverage && marginRequired !== null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-700 dark:text-amber-400 font-medium">Gerekli Teminat</span>
                    <span className="font-bold text-amber-900 dark:text-amber-100">{fmt(marginRequired)}</span>
                  </div>
                )}
              </div>
            )}

            {!isMetalAccount && (
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-muted-foreground w-1/3">Tutar</label>
                <div className="w-2/3 text-right text-lg font-bold text-foreground bg-secondary/5 rounded-xl px-4 py-2">
                  {fmt(totalAmount)}
                </div>
              </div>
            )}
            
          </div>

          {!canTrade && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Piyasa kapalı. İşlem saatleri: <strong>Pzt–Cum 10:00–18:00</strong></span>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!isVerified || parsedLots <= 0 || isPending || !canTrade}
            title={!canTrade ? "Piyasa kapalı: Pazartesi–Cuma 10:00–18:00" : undefined}
            className={`w-full h-12 text-base font-bold rounded-xl shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
              tab === "AL" 
                ? "bg-success hover:bg-success/90 shadow-success/25" 
                : "bg-destructive hover:bg-destructive/90 shadow-destructive/25"
            }`}
          >
            {isPending ? "İşleniyor..." : !canTrade ? "Piyasa Kapalı" : `Emir Ver (${tab})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
