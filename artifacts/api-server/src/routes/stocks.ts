import { Router } from "express";
import { db, watchlistTable, bistStocksTable } from "@workspace/db";
import { eq, and, or, ilike, sql as drizzleSql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { getStocks, getStock, getStockChart } from "../lib/stocks.js";
import _yfRaw from "yahoo-finance2";
import type { default as YFT } from "yahoo-finance2";
const _yfImport = _yfRaw as any;
const _YFClass = _yfImport?.default?.prototype?.quote ? _yfImport.default : _yfImport?.prototype?.quote ? _yfImport : _yfImport?.default;
const yf: YFT = new _YFClass() as YFT;

const FOREX_SYMBOLS = [
  { symbol: "USDTRY", yahoo: "USDTRY=X", name: "Dolar / TL" },
  { symbol: "EURTRY", yahoo: "EURTRY=X", name: "Euro / TL" },
  { symbol: "GBPTRY", yahoo: "GBPTRY=X", name: "Sterlin / TL" },
  { symbol: "EURUSD", yahoo: "EURUSD=X", name: "Euro / Dolar" },
  { symbol: "GBPUSD", yahoo: "GBPUSD=X", name: "Sterlin / Dolar" },
];

type ForexEntry = { symbol: string; name: string; price: number; change: number; changePercent: number; sparkline: number[] };
let forexCache: ForexEntry[] = [];
const forexHistory = new Map<string, number[]>(); // last 10 prices per symbol

async function fetchForexRates() {
  try {
    const results = await Promise.allSettled(
      FOREX_SYMBOLS.map(async (f) => {
        const q = await yf.quote(f.yahoo, {}, { validateResult: false }) as any;
        const item = Array.isArray(q) ? q[0] : q;
        return {
          symbol: f.symbol,
          name: f.name,
          price: item?.regularMarketPrice ?? 0,
          change: item?.regularMarketChange ?? 0,
          changePercent: item?.regularMarketChangePercent ?? 0,
        };
      })
    );
    const fetched = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value.price > 0)
      .map(r => r.value);
    if (fetched.length > 0) {
      const newCache = FOREX_SYMBOLS.map(f => {
        const updated = fetched.find(x => x.symbol === f.symbol);
        const existing = forexCache.find(x => x.symbol === f.symbol);
        const entry = updated ?? existing ?? { symbol: f.symbol, name: f.name, price: 0, change: 0, changePercent: 0 };
        // Update sparkline history
        if (entry.price > 0) {
          const hist = forexHistory.get(f.symbol) ?? [];
          hist.push(entry.price);
          if (hist.length > 10) hist.shift();
          forexHistory.set(f.symbol, hist);
        }
        return { ...entry, sparkline: forexHistory.get(f.symbol) ?? [] };
      });
      forexCache = newCache;
      console.log(`[forex] Updated ${fetched.length}/${FOREX_SYMBOLS.length} rates. USDTRY=${forexCache.find(x=>x.symbol==="USDTRY")?.price?.toFixed(2)}`);
    }
  } catch (err: any) {
    console.error("[forex] Fetch error:", err?.message?.slice(0, 100));
  }
}

setInterval(fetchForexRates, 30_000);
fetchForexRates();

const router = Router();

router.get("/stocks", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { sort, filter, search, minPrice, maxPrice, minChange, maxChange, volumeRange, watchlistOnly } = req.query;

    let stocks = getStocks();

    // Get user watchlist
    const watchlistItems = await db.select().from(watchlistTable).where(eq(watchlistTable.userId, user.id));
    const watchlistSymbols = new Set(watchlistItems.map(w => w.symbol));

    stocks = stocks.map(s => ({ ...s, isWatchlisted: watchlistSymbols.has(s.symbol) }));

    // Search filter — aktif hisseler filtrelenir, pasif hisseler DB'den eklenir
    if (search) {
      const q = (search as string).toLowerCase();
      stocks = stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));

      // Pasif hisseleri de DB'den çek — fiyat yoksa işlem kapalı olarak göster
      const activeSymbols = new Set(stocks.map(s => s.symbol));
      const inactiveRows = await db
        .select({ symbol: bistStocksTable.symbol, name: bistStocksTable.name })
        .from(bistStocksTable)
        .where(
          and(
            eq(bistStocksTable.isActive, false),
            or(
              ilike(bistStocksTable.symbol, `%${q}%`),
              ilike(bistStocksTable.name, `%${q}%`)
            )
          )
        )
        .limit(30);

      for (const row of inactiveRows) {
        if (activeSymbols.has(row.symbol)) continue;
        stocks.push({
          symbol: row.symbol,
          name: row.name,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          high: 0,
          low: 0,
          open: 0,
          previousClose: 0,
          isWatchlisted: watchlistSymbols.has(row.symbol),
          tradeable: false,
        } as any);
      }
    }

    // Status filter
    if (filter === "gainers") {
      stocks = stocks.filter(s => s.changePercent > 0);
    } else if (filter === "losers") {
      stocks = stocks.filter(s => s.changePercent < 0);
    } else if (filter === "most_volume") {
      stocks = [...stocks].sort((a, b) => b.volume - a.volume);
    }

    // Price range
    if (minPrice) stocks = stocks.filter(s => s.price >= Number(minPrice));
    if (maxPrice) stocks = stocks.filter(s => s.price <= Number(maxPrice));

    // Change range
    if (minChange) stocks = stocks.filter(s => s.changePercent >= Number(minChange));
    if (maxChange) stocks = stocks.filter(s => s.changePercent <= Number(maxChange));

    // Volume range
    if (volumeRange === "lt100k") stocks = stocks.filter(s => s.volume < 100000);
    else if (volumeRange === "100k_1m") stocks = stocks.filter(s => s.volume >= 100000 && s.volume < 1000000);
    else if (volumeRange === "1m_10m") stocks = stocks.filter(s => s.volume >= 1000000 && s.volume < 10000000);
    else if (volumeRange === "gt10m") stocks = stocks.filter(s => s.volume >= 10000000);

    // Watchlist only
    if (watchlistOnly === "true") {
      stocks = stocks.filter(s => watchlistSymbols.has(s.symbol));
    }

    // Sorting
    switch (sort) {
      case "name_desc": stocks.sort((a, b) => b.symbol.localeCompare(a.symbol)); break;
      case "price_desc": stocks.sort((a, b) => b.price - a.price); break;
      case "price_asc": stocks.sort((a, b) => a.price - b.price); break;
      case "change_desc": stocks.sort((a, b) => b.changePercent - a.changePercent); break;
      case "change_asc": stocks.sort((a, b) => a.changePercent - b.changePercent); break;
      case "volume_desc": stocks.sort((a, b) => b.volume - a.volume); break;
      case "volume_asc": stocks.sort((a, b) => a.volume - b.volume); break;
      default: stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    res.json(stocks);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/stocks/market-summary", authMiddleware, async (req, res) => {
  try {
    const stocks = getStocks().filter(s => s.symbol !== "XU100");
    const gainers = stocks.filter(s => s.changePercent > 0).length;
    const losers = stocks.filter(s => s.changePercent < 0).length;
    const total = stocks.length;

    const xu100 = getStock("XU100");
    const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);

    // Check if market is open (BIST: weekdays 10:00-18:00 Turkey time)
    const now = new Date();
    const istanbulHour = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getHours();
    const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getDay();
    const isOpen = dayOfWeek >= 1 && dayOfWeek <= 5 && istanbulHour >= 10 && istanbulHour < 18;

    res.json({
      isOpen,
      gainersPercent: Math.round((gainers / total) * 100),
      losersPercent: Math.round((losers / total) * 100),
      stablePercent: Math.round(((total - gainers - losers) / total) * 100),
      totalVolume,
      xu100: xu100 ? { price: xu100.price, change: xu100.change, changePercent: xu100.changePercent } : { price: 0, change: 0, changePercent: 0 },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/stocks/top-movers", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const watchlistItems = await db.select().from(watchlistTable).where(eq(watchlistTable.userId, user.id));
    const watchlistSymbols = new Set(watchlistItems.map(w => w.symbol));

    const stocks = getStocks()
      .filter(s => s.symbol !== "XU100")
      .map(s => ({ ...s, isWatchlisted: watchlistSymbols.has(s.symbol) }));

    const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
    const mostVolume = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);

    res.json({ gainers, losers, mostVolume });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/stocks/:symbol", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const symbol = String(req.params.symbol);
    const stock = getStock(symbol.toUpperCase());

    if (!stock) {
      return res.status(404).json({ error: "Not Found", message: "Hisse bulunamadı" });
    }

    const watchlistItems = await db.select().from(watchlistTable)
      .where(and(eq(watchlistTable.userId, user.id), eq(watchlistTable.symbol, symbol.toUpperCase())));

    res.json({ ...stock, isWatchlisted: watchlistItems.length > 0 });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/stocks/:symbol/chart", authMiddleware, async (req, res) => {
  try {
    const { symbol } = req.params;
    const range = (req.query.range as string) || "1d";
    const data = await getStockChart(symbol, range);
    res.json({ symbol, range, data });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Watchlist routes
const SENTINEL = "__INIT__";

router.get("/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const items = await db.select().from(watchlistTable).where(eq(watchlistTable.userId, user.id));
    const realItems = items.filter(i => i.symbol !== SENTINEL);

    if (items.length === 0) {
      // First time — auto-populate top 10 by volume + sentinel
      const top10 = [...getStocks()].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);
      try {
        await db.insert(watchlistTable).values({ userId: user.id, symbol: SENTINEL });
        for (const s of top10) {
          await db.insert(watchlistTable).values({ userId: user.id, symbol: s.symbol }).catch(() => {});
        }
      } catch {}
      return res.json(top10.map(s => s.symbol));
    }

    res.json(realItems.map(i => i.symbol));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Bad Request", message: "Hisse sembolü gerekli" });
    }

    try {
      await db.insert(watchlistTable).values({ userId: user.id, symbol: symbol.toUpperCase() });
    } catch {
      // Already in watchlist - ignore
    }

    res.json({ success: true, message: "İzleme listesine eklendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/forex", async (_req, res) => {
  res.json(forexCache);
});

router.delete("/watchlist/:symbol", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const symbol = String(req.params.symbol);

    await db.delete(watchlistTable)
      .where(and(eq(watchlistTable.userId, user.id), eq(watchlistTable.symbol, symbol.toUpperCase())));

    res.json({ success: true, message: "İzleme listesinden kaldırıldı" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/** Returns the current USD/TRY rate from the live forex cache */
export function getUsdTryRate(): number {
  return forexCache.find(x => x.symbol === "USDTRY")?.price ?? 44;
}

export default router;
