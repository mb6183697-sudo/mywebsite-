import { useEffect, useRef, useState, useCallback } from "react";
import { X, TrendingUp, TrendingDown, RefreshCw, ChevronLeft, BarChart2, LineChart } from "lucide-react";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";

interface Props {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  onMinimize: () => void;
  isUsd?: boolean;
}

const METAL_DISPLAY: Record<string, string> = { XAUTRYG: "XAUUSD", XAGTRYG: "XAGUSD" };
const displaySym = (s: string) => METAL_DISPLAY[s?.toUpperCase?.()] ?? s;

type Range = "1d" | "5d" | "1mo" | "3mo";

const RANGES: { label: string; value: Range }[] = [
  { label: "1G", value: "1d" },
  { label: "5G", value: "5d" },
  { label: "1A", value: "1mo" },
  { label: "3A", value: "3mo" },
];

function fmtPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") || localStorage.getItem("admin_auth_token");
}

async function fetchChartData(symbol: string, range: Range): Promise<any[]> {
  const token = getAuthToken();
  const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/chart?range=${range}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export default function StockChart({ symbol, name, currentPrice, changePercent, onMinimize, isUsd }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);  // chart canvas wrapper
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const [range, setRange] = useState<Range>("1mo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const isUp = changePercent >= 0;

  // Destroy the existing chart instance
  const destroyChart = useCallback(() => {
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    }
  }, []);

  // Build a fresh chart inside wrapperRef
  const buildChart = useCallback(() => {
    if (!wrapperRef.current) return null;
    destroyChart();

    const chart = createChart(wrapperRef.current, {
      autoSize: true,          // fills the container automatically
      layout: {
        background: { color: "#0a0a14" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,   // ← don't capture vertical swipe → OS scroll stays free
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,            // ← pinch-to-zoom on mobile
        axisPressedMouseMove: { time: true, price: true },
      },
    });

    chartRef.current = chart;
    return chart;
  }, [destroyChart]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const raw = await fetchChartData(symbol, range);
      if (!raw || raw.length === 0) {
        setError("Bu hisse için grafik verisi bulunamadı.");
        setLoading(false);
        return;
      }

      // Build chart AFTER data is ready (wrapper is mounted and has real dimensions)
      const chart = buildChart();
      if (!chart) { setLoading(false); return; }

      const useCandle =
        chartType === "candle" &&
        raw.every((d: any) => d.o != null && d.h != null && d.l != null);

      if (useCandle) {
        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderUpColor: "#22c55e",
          borderDownColor: "#ef4444",
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        });
        seriesRef.current = series as any;
        const data = raw
          .map((d: any) => ({ time: Math.floor(d.t / 1000) as any, open: d.o, high: d.h, low: d.l, close: d.c }))
          .sort((a: any, b: any) => a.time - b.time);
        series.setData(data);
      } else {
        const series = chart.addSeries(LineSeries, {
          color: isUp ? "#22c55e" : "#ef4444",
          lineWidth: 2,
        });
        seriesRef.current = series as any;
        const data = raw
          .map((d: any) => ({ time: Math.floor(d.t / 1000) as any, value: d.c }))
          .sort((a: any, b: any) => a.time - b.time);
        series.setData(data);
      }

      chart.timeScale().fitContent();
      setLoading(false);
    } catch {
      setError("Grafik verisi alınamadı. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  }, [symbol, range, chartType, isUp, buildChart]);

  // Load data whenever params change
  useEffect(() => {
    loadData();
    return destroyChart;
  }, [loadData, destroyChart]);

  // Prevent body scroll while chart overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Native click handler attached via ref — bypasses synthetic event system entirely
  // so lightweight-charts window listeners can't block it.
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("pointerdown", stop, { capture: true });
    el.addEventListener("pointermove", stop, { capture: true });
    el.addEventListener("pointerup", stop, { capture: true });
    el.addEventListener("touchstart", stop, { capture: true });
    el.addEventListener("touchmove", stop, { capture: true });
    el.addEventListener("touchend", stop, { capture: true });
    return () => {
      el.removeEventListener("pointerdown", stop, { capture: true });
      el.removeEventListener("pointermove", stop, { capture: true });
      el.removeEventListener("pointerup", stop, { capture: true });
      el.removeEventListener("touchstart", stop, { capture: true });
      el.removeEventListener("touchmove", stop, { capture: true });
      el.removeEventListener("touchend", stop, { capture: true });
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "#0a0a14", color: "#fff" }}
    >
      {/* ── Header + Toolbar (isolated from chart touch handlers) ── */}
      <div
        ref={headerRef}
        style={{ flexShrink: 0, zIndex: 200, position: "relative", touchAction: "manipulation" }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: "#1e1e3a", background: "#0d0d1a" }}
        >
          {/* Back / close */}
          <button
            onClick={onMinimize}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", touchAction: "manipulation" }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Geri</span>
          </button>

          {/* Symbol + badge */}
          <span className="font-bold text-base ml-1">{displaySym(symbol)}</span>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: isUp ? "#4ade80" : "#f87171" }}
          >
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
          </span>

          {/* Price (pushed right) */}
          <span className="ml-auto font-bold text-lg tabular-nums">
            {isUsd
              ? `$${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${fmtPrice(currentPrice)} ₺`}
          </span>

          {/* Close X */}
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg transition-colors ml-1"
            style={{ background: "rgba(255,255,255,0.06)", touchAction: "manipulation" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Toolbar ────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-b flex-wrap"
          style={{ borderColor: "#1e1e3a", background: "#0d0d1a" }}
        >
          {/* Range */}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className="px-2.5 py-0.5 text-xs font-semibold rounded transition-colors"
                style={{
                  background: range === r.value ? "#7c3aed" : "rgba(255,255,255,0.07)",
                  color: range === r.value ? "#fff" : "#9ca3af",
                  touchAction: "manipulation",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Chart type */}
          <div className="flex gap-1 ml-1">
            <button
              onClick={() => setChartType("candle")}
              title="Mum grafik"
              className="p-1 rounded transition-colors"
              style={{ background: chartType === "candle" ? "#7c3aed" : "rgba(255,255,255,0.07)", color: chartType === "candle" ? "#fff" : "#9ca3af", touchAction: "manipulation" }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType("line")}
              title="Çizgi grafik"
              className="p-1 rounded transition-colors"
              style={{ background: chartType === "line" ? "#7c3aed" : "rgba(255,255,255,0.07)", color: chartType === "line" ? "#fff" : "#9ca3af", touchAction: "manipulation" }}
            >
              <LineChart className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            title="Yenile"
            className="p-1 rounded transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", color: "#9ca3af", touchAction: "manipulation" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <span className="ml-auto text-xs" style={{ color: "#374151" }}>Yahoo Finance</span>
        </div>
      </div>

      {/* ── Chart area ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ overflow: "hidden", touchAction: "none" }}>
        {/* Loading overlay — pointer-events:none so it never blocks chart buttons */}
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "#0a0a14", zIndex: 20, pointerEvents: "none" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs" style={{ color: "#6b7280" }}>Grafik yükleniyor...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "#0a0a14", zIndex: 20 }}
          >
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
              <button
                onClick={loadData}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", touchAction: "manipulation" }}
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        )}

        {/* Chart canvas container — fills remaining space */}
        <div
          ref={wrapperRef}
          style={{ position: "absolute", inset: 0, touchAction: "pan-x" }}
        />
      </div>
    </div>
  );
}
