import { Router } from "express";
import { db, usersTable, ordersTable, balanceTransactionsTable, spreadGroupStocksTable, globalStockSpreadsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { getStock, getLivePrice, getStockName } from "../lib/stocks.js";
import { checkMarketStatus } from "../lib/marketHours.js";

const METAL_SYMBOLS = new Set(["XAUTRYG", "XAGTRYG", "BRENTOIL", "WTIOIL"]);

// Sözleşme büyüklükleri (lot başına birim)
// Altın: 100 oz/lot | Gümüş: 5000 oz/lot | Ham Petrol: 1000 varil/lot
const CONTRACT_SIZES: Record<string, number> = {
  XAUTRYG: 100,
  XAGTRYG: 5000,
  BRENTOIL: 1000,
  WTIOIL: 1000,
};
function getContractSize(symbol: string): number {
  return CONTRACT_SIZES[symbol.toUpperCase()] ?? 1;
}

/**
 * Spread sonuç tipi.
 * isTL=true  → buy/sell değerleri LOT BAŞINA TL cinsinden (spreadAdjustment = lots * value)
 * isTL=false → buy/sell değerleri YÜZDE (spreadAdjustment = totalAmount * value / 100)
 */
interface SpreadResult { isTL: boolean; buy: number; sell: number; }

/** Kullanıcının spread değerini hesapla:
 *  1. Kullanıcı grubuna atanmışsa → o grubun hisse-bazlı TL spreadini kullan
 *  2. Grupta yoksa → global_stock_spreads TL tablosuna bak
 *  3. Hiçbiri yoksa → user.spreadPercent yüzde varsayılanına dön */
async function getUserSpread(user: any, symbol: string): Promise<SpreadResult> {
  // 1. Grup spreadi (TL/lot)
  if (user.spreadGroupId) {
    const rows = await db.select().from(spreadGroupStocksTable)
      .where(and(eq(spreadGroupStocksTable.groupId, user.spreadGroupId), eq(spreadGroupStocksTable.symbol, symbol)));
    if (rows.length > 0) return { isTL: true, buy: rows[0].buySpread, sell: rows[0].sellSpread };
  }

  // 2. Global hisse-bazlı TL spreadi
  const globalRows = await db.select().from(globalStockSpreadsTable)
    .where(eq(globalStockSpreadsTable.symbol, symbol));
  if (globalRows.length > 0) return { isTL: true, buy: globalRows[0].buySpread, sell: globalRows[0].sellSpread };

  // 3. Yüzde bazlı varsayılan
  const pct = user.spreadPercent ?? 0.5;
  return { isTL: false, buy: pct, sell: pct };
}

/** Spread tutarını hesapla (TL veya % bazlı olabilir) */
function calcSpreadAmount(spread: SpreadResult, direction: "buy" | "sell", lots: number, totalAmount: number): number {
  const val = direction === "sell" ? spread.sell : spread.buy;
  return spread.isTL ? lots * val : (totalAmount * val) / 100;
}

const router = Router();

/**
 * Turkish public holidays (BIST closed) — includes arife (eve) days.
 * Update annually; covers 2024-2027.
 */
const TURKISH_HOLIDAYS = new Set([
  // Fixed holidays
  ...["2024","2025","2026","2027"].flatMap(y => [
    `${y}-01-01`, // Yılbaşı
    `${y}-04-23`, // Ulusal Egemenlik ve Çocuk Bayramı
    `${y}-05-01`, // İşçi ve Emekçi Bayramı
    `${y}-05-19`, // Atatürk'ü Anma, Gençlik ve Spor Bayramı
    `${y}-07-15`, // Demokrasi ve Millî Birlik Günü
    `${y}-08-30`, // Zafer Bayramı
    `${y}-10-29`, // Cumhuriyet Bayramı
  ]),
  // Ramazan Bayramı 2024 (Arife + 3 gün): Apr 9-12
  "2024-04-09","2024-04-10","2024-04-11","2024-04-12",
  // Kurban Bayramı 2024 (Arife + 4 gün): Jun 15-19
  "2024-06-15","2024-06-16","2024-06-17","2024-06-18","2024-06-19",
  // Ramazan Bayramı 2025 (Arife + 3 gün): Mar 29 - Apr 1
  "2025-03-29","2025-03-30","2025-03-31","2025-04-01",
  // Kurban Bayramı 2025 (Arife + 4 gün): Jun 5-9
  "2025-06-05","2025-06-06","2025-06-07","2025-06-08","2025-06-09",
  // Ramazan Bayramı 2026 (Arife + 3 gün): Mar 19-22
  "2026-03-19","2026-03-20","2026-03-21","2026-03-22",
  // Kurban Bayramı 2026 (Arife + 4 gün): May 26-30
  "2026-05-26","2026-05-27","2026-05-28","2026-05-29","2026-05-30",
  // Ramazan Bayramı 2027 (Arife + 3 gün): Mar 9-12
  "2027-03-09","2027-03-10","2027-03-11","2027-03-12",
  // Kurban Bayramı 2027 (Arife + 4 gün): May 16-20
  "2027-05-16","2027-05-17","2027-05-18","2027-05-19","2027-05-20",
]);

/** Returns true if the given date (in Istanbul local date) is a BIST trading day */
function isTradingDay(date: Date): boolean {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const dow = istDate.getDay();
  if (dow === 0 || dow === 6) return false; // weekend
  const iso = `${istDate.getFullYear()}-${String(istDate.getMonth()+1).padStart(2,"0")}-${String(istDate.getDate()).padStart(2,"0")}`;
  return !TURKISH_HOLIDAYS.has(iso);
}

/**
 * Add N BIST business days to a date.
 * Settlement is considered complete at start (00:00 Istanbul) of the settlement day.
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isTradingDay(result)) added++;
  }
  // Settle at beginning of settlement day in Istanbul (≈ UTC-3)
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Calculate T+2 pending balance: sum of trade_close proceeds not yet settled.
 *  Uses order.closedAt (admin-settable) as reference date so backdating works correctly. */
async function calcT2Balance(userId: number): Promise<number> {
  // Use a wide lookback on tx.createdAt to catch recently-created transactions for backdated orders
  const lookback = new Date(Date.now() - 10 * 86400_000);
  const trades = await db
    .select({
      txCreatedAt: balanceTransactionsTable.createdAt,
      amount: balanceTransactionsTable.amount,
      orderClosedAt: ordersTable.closedAt,
    })
    .from(balanceTransactionsTable)
    .leftJoin(ordersTable, eq(balanceTransactionsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(balanceTransactionsTable.userId, userId),
        eq(balanceTransactionsTable.type, "trade_close"),
        gte(balanceTransactionsTable.createdAt, lookback)
      )
    );

  const now = new Date();
  let t2 = 0;
  for (const tx of trades) {
    // Prefer the order's actual closedAt (admin can backdate) over tx timestamp
    const refDate = tx.orderClosedAt || tx.txCreatedAt;
    const settlementDate = addBusinessDays(refDate, 2);
    if (now < settlementDate && tx.amount > 0) {
      t2 += tx.amount;
    }
  }
  return Math.round(t2 * 100) / 100;
}

router.get("/portfolio", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const isLeveraged = !!(user.isMetalAccount && user.leverage && user.leverage > 1);

    // Get open positions
    const openOrders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.userId, user.id), eq(ordersTable.status, "open")))
      .orderBy(desc(ordersTable.createdAt));

    let portfolioValue = 0;
    let profitLoss = 0;
    let openPositionCost = 0; // for leveraged: sum of margins; for spot: sum of position costs

    const positions = await Promise.all(openOrders.map(async (order) => {
      const livePrice = getLivePrice(order.symbol);
      const currentPrice = livePrice ?? order.openPrice ?? 0;
      const cs = getContractSize(order.symbol); // sözleşme büyüklüğü
      const currentValue = currentPrice * order.lots * cs;
      const openPrice = order.openPrice || 0;
      const notionalCost = openPrice * order.lots * cs; // full position value at open

      // For leveraged orders: totalAmount = margin; for spot: totalAmount = position cost
      const marginOrCost = order.totalAmount || notionalCost;

      // Güncel grup spreadi kullan (admin değişikliği anlık yansısın)
      const groupSpread = await getUserSpread(user, order.symbol);
      const isBuy = order.direction === "buy";
      const liveSpreadAmt = calcSpreadAmount(groupSpread, isBuy ? "buy" : "sell", order.lots, notionalCost);
      const commissionAmt = order.commissionAmount || 0;
      const swapAmt = order.swapAmount || 0;

      // P&L: (fiyat farkı × lot) − masraflar. Kaldıraçlı hesaplarda tam notional üzerinden.
      let pnl = 0;
      if (isBuy) {
        pnl = (currentValue - notionalCost) - liveSpreadAmt - commissionAmt - swapAmt;
      } else {
        pnl = (notionalCost - currentValue) - liveSpreadAmt - commissionAmt - swapAmt;
      }

      if (isLeveraged) {
        // Kaldıraçlı hesap: portfolioValue = pozisyonun anlık piyasa değeri
        portfolioValue += currentValue;
      } else if (isBuy) {
        // Spot alış: portföy değeri = hisselerin anlık piyasa değeri
        portfolioValue += currentValue;
      } else {
        // Spot satış: bakiye kilitlendi (notionalCost). Anlık "geri alım değeri" =
        // kilitli tutar + brüt K/Z = totalAmount + (notionalCost - currentValue)
        // Bu sayede fiyat düştüğünde (kâr) toplam değer artar, yükseldiğinde azalır.
        portfolioValue += notionalCost + (notionalCost - currentValue);
      }
      openPositionCost += marginOrCost; // margin for leveraged, full cost for spot
      profitLoss += pnl;

      return {
        id: order.id,
        symbol: order.symbol,
        stockName: order.stockName || getStockName(order.symbol),
        direction: order.direction,
        lots: order.lots,
        openPrice,
        currentPrice,
        closePrice: order.closePrice || 0,
        totalCost: notionalCost,
        margin: marginOrCost,
        leverage: order.leverage || null,
        currentValue,
        profitLoss: Math.round(pnl * 100) / 100,
        profitLossPercent: notionalCost > 0 ? Math.round((pnl / notionalCost) * 10000) / 100 : 0,
        spreadAdjustment: Math.round(liveSpreadAmt * 100) / 100,
        commissionAmount: commissionAmt,
        swapAmount: swapAmt,
        status: order.status,
        openedAt: order.createdAt.toISOString(),
        closedAt: order.closedAt?.toISOString() || "",
      };
    }));

    const profitLossPercent = portfolioValue > 0 ? (profitLoss / portfolioValue) * 100 : 0;

    if (isLeveraged) {
      // ── Kaldıraçlı hesap (Değerli Metaller) metrikleri ────────────────────
      // equity = nakit + yüzen K/Z (bakiye + açık pozisyon K/Z)
      const equity = Math.round((user.balance + profitLoss) * 100) / 100;
      // usedMargin = açık pozisyonlar için yatırılan toplam teminat
      const usedMargin = Math.round(openPositionCost * 100) / 100;
      // freeMargin = equity − usedMargin (yeni pozisyon açmak için kullanılabilir)
      const freeMargin = Math.round((equity - usedMargin) * 100) / 100;
      // marginLevel = equity / usedMargin × 100 (%)
      const marginLevel = usedMargin > 0 ? Math.round((equity / usedMargin) * 10000) / 100 : null;

      return res.json({
        isLeveraged: true,
        leverage: user.leverage,
        balanceCurrency: user.balanceCurrency || "TRY",
        availableBalance: freeMargin,
        frozenBalance: user.frozenBalance,
        portfolioValue: Math.round(portfolioValue * 100) / 100,
        totalBalance: equity,
        totalValue: equity,
        openPositionCost: usedMargin,
        // Kaldıraçlı özel metrikler
        equity,
        usedMargin,
        freeMargin,
        marginLevel,
        balance: Math.round(user.balance * 100) / 100,
        profitLoss: Math.round(profitLoss * 100) / 100,
        profitLossPercent: Math.round(profitLossPercent * 100) / 100,
        positions,
        // Metal hesaplarda T+2 yok
        t2Balance: 0,
        lockedBalance: usedMargin,
        kullanilabilir: freeMargin,
        withdrawableBalance: Math.round(user.balance * 100) / 100,
      });
    }

    // ── Spot hesap (BIST) metrikleri ──────────────────────────────────────────
    const t2Balance = await calcT2Balance(user.id);

    // Kullanılabilir = mevcut nakit (tüm nakit — t2 dahil, işlem için kullanılabilir)
    const kullanilabilir = Math.round(user.balance * 100) / 100;

    // Kilitli = yalnızca açık pozisyonların anlık piyasa değeri
    // NOT: t2Balance zaten user.balance içinde yer alır — lockedBalance'a eklemek çift sayım olur
    const lockedBalance = Math.round(portfolioValue * 100) / 100;

    // Bakiye = Kullanılabilir (nakit) + Kilitli (açık poz. değeri) — admin paneli ile birebir eşleşir
    const totalBalance = Math.round((kullanilabilir + lockedBalance) * 100) / 100;

    res.json({
      isLeveraged: false,
      availableBalance: kullanilabilir,
      frozenBalance: user.frozenBalance,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      totalBalance,
      totalValue: totalBalance,
      openPositionCost: Math.round(openPositionCost * 100) / 100,
      t2Balance,
      lockedBalance,
      kullanilabilir,
      withdrawableBalance: Math.round((user.balance - t2Balance) * 100) / 100,
      profitLoss: Math.round(profitLoss * 100) / 100,
      profitLossPercent: Math.round(profitLossPercent * 100) / 100,
      positions,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Orders
router.get("/orders", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { status } = req.query;

    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.userId, user.id))
      .orderBy(desc(ordersTable.createdAt));

    let filtered = orders;
    if (status === "open") {
      filtered = orders.filter(o => o.status === "open" || o.status === "pending");
    } else if (status === "closed") {
      filtered = orders.filter(o => o.status === "closed" || o.status === "filled");
    }

    const result = filtered.map(order => {
      const livePrice = getLivePrice(order.symbol);
      const currentPrice = livePrice ?? order.openPrice ?? 0;
      const currentValue = currentPrice * order.lots;
      const notionalCost = (order.openPrice || 0) * order.lots;
      let pnl = null;
      if (order.status === "closed" && order.closePrice) {
        const rawPnl = order.direction === "buy"
          ? (order.closePrice - (order.openPrice || 0)) * order.lots
          : ((order.openPrice || 0) - order.closePrice) * order.lots;
        // Net P&L: spread ve komisyon düşülmüş (bakiyeyle uyumlu)
        pnl = rawPnl - (order.spreadAdjustment || 0) - (order.commissionAmount || 0) - (order.swapAmount || 0);
      }

      return {
        id: order.id,
        symbol: order.symbol,
        stockName: order.stockName || getStockName(order.symbol),
        type: order.type,
        direction: order.direction,
        lots: order.lots,
        price: order.price,
        limitPrice: order.limitPrice,
        totalAmount: order.totalAmount,
        leverage: order.leverage || null,
        status: order.status,
        openPrice: order.openPrice,
        closePrice: order.closePrice,
        profitLoss: pnl !== null ? Math.round(pnl * 100) / 100 : null,
        spreadAdjustment: order.spreadAdjustment,
        commissionAmount: order.commissionAmount,
        createdAt: order.createdAt.toISOString(),
        filledAt: order.filledAt?.toISOString() || null,
        closedAt: order.closedAt?.toISOString() || null,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { symbol, type, direction, lots, limitPrice } = req.body;
    const isMetalAccount = !!user.isMetalAccount;
    const leverage = isMetalAccount && user.leverage ? user.leverage : null;
    const symbolUpper = (symbol || "").toUpperCase();
    const isMetalSymbol = METAL_SYMBOLS.has(symbolUpper);

    // Metal hesap: piyasa saati kısıtı yok (altın/gümüş 7/24 işlem görür)
    if (!isMetalAccount) {
      const market = checkMarketStatus();
      if (!market.open) {
        return res.status(400).json({ error: "Piyasa Kapalı", message: market.reason });
      }
    }

    if (!user.isIdentityVerified) {
      return res.status(403).json({ error: "Forbidden", message: "İşlem yapabilmek için kimlik doğrulaması gerekli" });
    }

    if (!symbol || !type || !direction || !lots) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz emir parametreleri" });
    }

    // Metal hesap: kesirli lot (0.01), spot: tam sayı lot (min 1)
    let lotsNum: number;
    if (isMetalSymbol) {
      lotsNum = Math.round(Number(lots) * 100) / 100;
      if (lotsNum < 0.01) {
        return res.status(400).json({ error: "Bad Request", message: "Minimum 0.01 lot işlem yapabilirsiniz" });
      }
    } else {
      lotsNum = Math.floor(Number(lots));
      if (lotsNum < 1) {
        return res.status(400).json({ error: "Bad Request", message: "Minimum 1 lot işlem yapabilirsiniz" });
      }
    }

    const stock = getStock(symbolUpper);
    if (!stock) {
      return res.status(404).json({ error: "Not Found", message: "Hisse bulunamadı" });
    }

    const executionPrice = type === "limit" && limitPrice ? limitPrice : stock.price;
    const contractSize = getContractSize(symbolUpper); // sözleşme büyüklüğü (1 = spot)
    const notionalAmount = executionPrice * lotsNum * contractSize; // tam pozisyon değeri

    // Grup spreadi kullan (alış/satış yönüne göre) — TL veya yüzde olabilir
    const groupSpread = await getUserSpread(user, symbolUpper);
    const commissionPercent = user.commissionPercent ?? 0.01;
    const spreadAdjustment = calcSpreadAmount(groupSpread, direction as "buy" | "sell", lotsNum, notionalAmount);
    const commissionAmount = (notionalAmount * commissionPercent) / 100;

    if (isMetalAccount && leverage) {
      // ── Kaldıraçlı hesap (Değerli Metaller) ──────────────────────────────
      // Her iki yönde de teminat yatırılır (alış ve satış)
      const marginRequired = notionalAmount / leverage; // teminat = tam değer / kaldıraç
      const totalCost = marginRequired + spreadAdjustment + commissionAmount;

      const curr = user.balanceCurrency === "USD" ? "$" : "₺";
      if (user.balance < totalCost) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Yetersiz teminat. Gerekli: ${curr}${totalCost.toFixed(2)}, Mevcut: ${curr}${user.balance.toFixed(2)}`,
        });
      }

      await db.update(usersTable)
        .set({ balance: user.balance - totalCost, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      await db.insert(balanceTransactionsTable).values({
        userId: user.id,
        type: "trade_open",
        amount: -totalCost,
        balanceBefore: user.balance,
        balanceAfter: user.balance - totalCost,
        description: `${symbolUpper} ${lotsNum} lot ${direction === "buy" ? "ALIŞ" : "SATIŞ"} (1:${leverage} kaldıraç, teminat: ${user.balanceCurrency === "USD" ? "$" : "₺"}${marginRequired.toFixed(2)})`,
      });

      const [order] = await db.insert(ordersTable).values({
        userId: user.id,
        symbol: symbolUpper,
        stockName: stock.name,
        type,
        direction,
        lots: lotsNum,
        price: executionPrice,
        limitPrice: limitPrice ? Number(limitPrice) : null,
        totalAmount: marginRequired, // teminat saklanır (tam değer değil)
        status: "open",
        openPrice: executionPrice,
        spreadAdjustment,
        commissionAmount,
        leverage,
        filledAt: new Date(),
      }).returning();

      return res.status(201).json({
        id: order.id,
        symbol: order.symbol,
        stockName: order.stockName,
        type: order.type,
        direction: order.direction,
        lots: order.lots,
        price: order.price,
        limitPrice: order.limitPrice,
        totalAmount: order.totalAmount,
        leverage: order.leverage,
        status: order.status,
        openPrice: order.openPrice,
        spreadAdjustment: order.spreadAdjustment,
        commissionAmount: order.commissionAmount,
        createdAt: order.createdAt.toISOString(),
        filledAt: order.filledAt?.toISOString() || null,
        closedAt: null,
      });
    }

    // ── Spot hesap (BIST) ──────────────────────────────────────────────────
    const totalCost = notionalAmount + spreadAdjustment + commissionAmount;

    // Check balance for buy orders
    if (direction === "buy" && user.balance < totalCost) {
      return res.status(400).json({ error: "Bad Request", message: "Yetersiz bakiye" });
    }

    // Deduct balance for buy orders
    if (direction === "buy") {
      await db.update(usersTable)
        .set({ balance: user.balance - totalCost, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      await db.insert(balanceTransactionsTable).values({
        userId: user.id,
        type: "trade_open",
        amount: -totalCost,
        balanceBefore: user.balance,
        balanceAfter: user.balance - totalCost,
        description: `${symbolUpper} ${lotsNum} lot ALIŞ emri`,
      });
    }

    // Satış emirleri alış emirleri gibi tam notional tutarı kilitler.
    // Bakiye kontrolü yapılır; sahiplik kontrolü yapılmaz.
    if (direction === "sell") {
      if (user.balance < totalCost) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Yetersiz bakiye. Gerekli: ₺${totalCost.toFixed(2)}, Mevcut: ₺${user.balance.toFixed(2)}`,
        });
      }

      await db.update(usersTable)
        .set({ balance: user.balance - totalCost, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      await db.insert(balanceTransactionsTable).values({
        userId: user.id,
        type: "trade_open",
        amount: -totalCost,
        balanceBefore: user.balance,
        balanceAfter: user.balance - totalCost,
        description: `${symbolUpper} ${lotsNum} lot SATIŞ emri`,
      });
    }

    const [order] = await db.insert(ordersTable).values({
      userId: user.id,
      symbol: symbolUpper,
      stockName: stock.name,
      type,
      direction,
      lots: lotsNum,
      price: executionPrice,
      limitPrice: limitPrice ? Number(limitPrice) : null,
      totalAmount: notionalAmount,
      status: "open",
      openPrice: executionPrice,
      spreadAdjustment,
      commissionAmount,
      leverage: null,
      filledAt: new Date(),
    }).returning();

    res.status(201).json({
      id: order.id,
      symbol: order.symbol,
      stockName: order.stockName,
      type: order.type,
      direction: order.direction,
      lots: order.lots,
      price: order.price,
      limitPrice: order.limitPrice,
      totalAmount: order.totalAmount,
      status: order.status,
      openPrice: order.openPrice,
      spreadAdjustment: order.spreadAdjustment,
      commissionAmount: order.commissionAmount,
      createdAt: order.createdAt.toISOString(),
      filledAt: order.filledAt?.toISOString() || null,
      closedAt: null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders/:id/close", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const orderId = Number(req.params.id);
    const isMetalAccount = !!user.isMetalAccount;

    // Metal hesap: piyasa saati kısıtı yok
    if (!isMetalAccount) {
      const market = checkMarketStatus();
      if (!market.open) {
        return res.status(400).json({ error: "Piyasa Kapalı", message: market.reason });
      }
    }

    const orders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, user.id)));

    if (!orders.length) {
      return res.status(404).json({ error: "Not Found", message: "Emir bulunamadı" });
    }

    const order = orders[0];
    if (order.status !== "open") {
      return res.status(400).json({ error: "Bad Request", message: "Bu emir zaten kapalı" });
    }

    const stock = getStock(order.symbol);
    const closePrice = stock?.price || order.openPrice || 0;
    const openPrice = order.openPrice || 0;

    // Brüt K/Z: tam pozisyon değeri üzerinden (kaldıraçlı veya spot)
    const closeContractSize = getContractSize(order.symbol);
    let grossPnl = 0;
    if (order.direction === "buy") {
      grossPnl = (closePrice - openPrice) * order.lots * closeContractSize;
    } else {
      grossPnl = (openPrice - closePrice) * order.lots * closeContractSize;
    }

    const spreadCost = order.spreadAdjustment || 0;
    const commCost = order.commissionAmount || 0;
    const swapCost = order.swapAmount || 0;
    const netPnl = grossPnl - spreadCost - commCost - swapCost;

    // Geri ödenecek tutar: yatırılan teminat/maliyet + net K/Z
    // Kaldıraçlı: order.totalAmount = teminat; spot: order.totalAmount = pozisyon maliyeti
    const returnAmount = order.totalAmount + netPnl;
    const newBalance = user.balance + returnAmount;

    await db.update(usersTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await db.insert(balanceTransactionsTable).values({
      userId: user.id,
      type: "trade_close",
      amount: returnAmount,
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      description: `${order.symbol} ${order.lots} lot kapandı - Net K/Z: ${netPnl.toFixed(2)} ₺`,
      orderId: order.id,
    });

    const [updatedOrder] = await db.update(ordersTable)
      .set({
        status: "closed",
        closePrice,
        profitLoss: Math.round(netPnl * 100) / 100,
        closedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId))
      .returning();

    res.json({
      ...updatedOrder,
      closedAt: updatedOrder.closedAt?.toISOString() || null,
      createdAt: updatedOrder.createdAt.toISOString(),
      filledAt: updatedOrder.filledAt?.toISOString() || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Balance operations - deposit removed (deposits only via deposit-requests with admin approval)

router.post("/balance/withdraw", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    if (!user.isIdentityVerified) {
      return res.status(403).json({ error: "Forbidden", message: "Para çekmek için kimlik doğrulaması gerekli" });
    }

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Bad Request", message: "Geçerli bir tutar giriniz" });
    }

    const t2Balance = await calcT2Balance(user.id);
    const availableBalance = user.balance - t2Balance;

    if (availableBalance < Number(amount)) {
      const msg = t2Balance > 0
        ? `Yetersiz bakiye. Kullanılabilir: ${availableBalance.toFixed(2)} ₺ — T+2 beklemede: ${t2Balance.toFixed(2)} ₺ (2 iş günü içinde serbest kalır)`
        : "Yetersiz bakiye";
      return res.status(400).json({ error: "Bad Request", message: msg });
    }

    const newBalance = user.balance - Number(amount);

    await db.update(usersTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await db.insert(balanceTransactionsTable).values({
      userId: user.id,
      type: "withdraw",
      amount: -Number(amount),
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      description: `Para çekme - ${amount} ₺`,
    });

    await updateAccountType(user.id, newBalance);

    res.json({ success: true, message: "Para çekme işlemi başarılı" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/balance/history", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const transactions = await db.select().from(balanceTransactionsTable)
      .where(eq(balanceTransactionsTable.userId, user.id))
      .orderBy(desc(balanceTransactionsTable.createdAt));

    res.json(transactions.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

async function updateAccountType(userId: number, balance: number) {
  let accountType = "standard";
  if (balance > 1000000) accountType = "diamond";
  else if (balance > 250000) accountType = "gold";
  else if (balance >= 100000) accountType = "silver";

  await db.update(usersTable)
    .set({ accountType, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}

export default router;
