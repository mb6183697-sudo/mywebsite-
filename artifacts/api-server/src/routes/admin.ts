import { Router } from "express";
import { db, usersTable, ordersTable, balanceTransactionsTable, notificationsTable, depositRequestsTable, withdrawalRequestsTable, tierApplicationsTable, bistStocksTable, spreadGroupsTable, spreadGroupStocksTable, globalStockSpreadsTable } from "@workspace/db";
import { eq, like, or, desc, and, sql, ilike, inArray } from "drizzle-orm";
import { sanitizeUser } from "./auth.js";
import { getStock, getLivePrice, getLiveCacheSize, getRegistrySize, reloadRegistry, fetchSymbolsNow } from "../lib/stocks.js";
import { hashPassword, generateAccountId } from "../lib/auth.js";
import { checkMarketStatus } from "../lib/marketHours.js";

/**
 * Admin panelinden gelen datetime-local stringleri ("YYYY-MM-DDTHH:MM") İstanbul saati
 * olarak yorumlar ve UTC'ye çevirir. Türkiye DST uygulamaz → daima UTC+3.
 * Eğer string zaten timezone bilgisi içeriyorsa (Z veya +) doğrudan parse edilir.
 */
function parseIstanbul(s: string): Date {
  if (!s) return new Date(NaN);
  const hasZone = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasZone ? s : s + "+03:00");
}

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const allUsers = await db.select().from(usersTable);
    const allOrders = await db.select().from(ordersTable);
    const allTransactions = await db.select().from(balanceTransactionsTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDeposits = allTransactions
      .filter(t => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = allTransactions
      .filter(t => t.type === "withdraw")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const openPositions = allOrders.filter(o => o.status === "open").length;

    const todayNewUsers = allUsers.filter(u => {
      const createdAt = new Date(u.createdAt);
      return createdAt >= today;
    }).length;

    const pendingVerifications = allUsers.filter(u => u.identityStatus === "pending").length;

    // Recent activities
    const recentTransactions = allTransactions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    const recentUsers = allUsers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const recentActivities: any[] = [
      ...recentUsers.map(u => ({
        type: "new_user",
        message: `Yeni hesap: ${u.firstName} ${u.lastName} (#${u.accountId})`,
        createdAt: u.createdAt.toISOString(),
      })),
      ...recentTransactions.slice(0, 10).map(t => ({
        type: t.type,
        message: `${t.description || t.type} - ${Math.abs(t.amount).toFixed(2)} ₺`,
        createdAt: t.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);

    res.json({
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(u => !u.isAdmin).length,
      pendingVerifications,
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
      openPositions,
      todayNewUsers,
      recentActivities,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

    // Filter by userType: "real" = normal client accounts, "test_ib" = test/IB/admin accounts
    const { userType } = req.query;
    if (userType === "real") {
      // Gerçek hesap = test değil, IB değil, admin değil, IB alt hesabı değil, metal alt hesabı değil
      // Metal alt hesapları (isMetalAccount=true) ayrı listede değil — ana kullanıcı üzerinden erişilir
      users = users.filter(u => !u.isTest && !u.ibReferralCode && !u.isAdmin && !u.subAccountName && !u.isMetalAccount);
    } else if (userType === "test_ib") {
      // subAccountName dolu = IB alt hesabı (test) — ama metal alt hesapları hariç
      users = users.filter(u => !u.isMetalAccount && (u.isTest || Boolean(u.ibReferralCode) || u.isAdmin || Boolean(u.subAccountName)));
    }

    if (search) {
      const q = (search as string).toLowerCase();
      users = users.filter(u =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.accountId.includes(q) ||
        u.phone.includes(q)
      );
    }

    const total = users.length;
    const totalBalance = users.reduce((s, u) => s + (u.balance || 0), 0);
    const paginated = users.slice(offset, offset + limitNum);

    // Her kullanıcı için açık pozisyonların piyasa değerini hesapla → toplam varlık (equity)
    const paginatedIds = paginated.map(u => u.id);
    const openOrders = paginatedIds.length > 0
      ? await db.select().from(ordersTable)
          .where(and(
            eq(ordersTable.status, "open"),
            inArray(ordersTable.userId, paginatedIds)
          ))
      : [];

    const portfolioByUser: Record<number, number> = {};
    for (const o of openOrders) {
      const livePrice = getLivePrice(o.symbol);
      const price = livePrice ?? o.openPrice ?? 0;
      portfolioByUser[o.userId] = (portfolioByUser[o.userId] || 0) + price * o.lots;
    }

    const usersWithEquity = paginated.map(u => ({
      ...sanitizeUser(u),
      portfolioValue: Math.round((portfolioByUser[u.id] || 0) * 100) / 100,
      equity: Math.round(((u.balance || 0) + (portfolioByUser[u.id] || 0)) * 100) / 100,
    }));

    res.json({
      users: usersWithEquity,
      total,
      totalBalance: Math.round(totalBalance * 100) / 100,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!users.length) {
      return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    }

    // Fetch parent IB info if user belongs to an IB
    let parentIb: { id: number; firstName: string; lastName: string; accountId: string; ibReferralCode: string | null } | null = null;
    if (users[0].parentIbId) {
      const [ib] = await db.select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        accountId: usersTable.accountId,
        ibReferralCode: usersTable.ibReferralCode,
      }).from(usersTable).where(eq(usersTable.id, users[0].parentIbId));
      if (ib) parentIb = ib;
    }

    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.userId, userId))
      .orderBy(desc(ordersTable.createdAt));

    const balanceHistory = await db.select().from(balanceTransactionsTable)
      .where(eq(balanceTransactionsTable.userId, userId))
      .orderBy(desc(balanceTransactionsTable.createdAt));

    const ordersWithDetails = orders.map(order => {
      const livePrice = getLivePrice(order.symbol);
      const stock = getStock(order.symbol);
      // For display: use live price if available, else best static fallback
      const currentPrice = order.status === "open"
        ? (livePrice ?? stock?.price ?? order.openPrice ?? 0)
        : (order.closePrice ?? 0);
      let profitLoss = order.profitLoss;
      // Only recompute P&L when we actually have a live Yahoo Finance price
      if (order.status === "open" && order.openPrice && livePrice !== null) {
        const rawPnl = order.direction === "buy"
          ? (livePrice - order.openPrice) * order.lots
          : (order.openPrice - livePrice) * order.lots;
        profitLoss = Math.round(rawPnl * 100) / 100;
      }
      return {
        ...order,
        currentPrice,
        profitLoss,
        hasLivePrice: livePrice !== null,
        createdAt: order.createdAt.toISOString(),
        filledAt: order.filledAt?.toISOString() || null,
        closedAt: order.closedAt?.toISOString() || null,
      };
    });

    // Metal sub-hesaplar (bu kullanıcı ana hesap ise)
    const metalSubAccounts = await db.select({
      id: usersTable.id,
      accountId: usersTable.accountId,
      subAccountName: usersTable.subAccountName,
      balance: usersTable.balance,
      balanceCurrency: usersTable.balanceCurrency,
      leverage: usersTable.leverage,
      createdAt: usersTable.createdAt,
    }).from(usersTable)
      .where(and(eq(usersTable.metalParentId, userId), eq(usersTable.isMetalAccount, true)));

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      user: sanitizeUser(users[0]),
      parentIb,
      orders: ordersWithDetails,
      balanceHistory: balanceHistory.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
      metalSubAccounts: metalSubAccounts.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ── Live P&L for open positions (lightweight, no-cache, poll frequently) ──────
router.get("/users/:id/live-pnl", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const openOrders = await db.select({
      id: ordersTable.id,
      symbol: ordersTable.symbol,
      direction: ordersTable.direction,
      lots: ordersTable.lots,
      openPrice: ordersTable.openPrice,
      spreadAdjustment: ordersTable.spreadAdjustment,
      commissionAmount: ordersTable.commissionAmount,
      swapAmount: ordersTable.swapAmount,
      status: ordersTable.status,
    }).from(ordersTable)
      .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "open")));

    const result = openOrders.map(o => {
      const livePrice = getLivePrice(o.symbol);
      const stock = getStock(o.symbol);
      const currentPrice = livePrice ?? stock?.price ?? o.openPrice ?? 0;
      let profitLoss: number | null = null;
      if (o.openPrice && livePrice !== null) {
        const rawPnl = o.direction === "buy"
          ? (livePrice - o.openPrice) * o.lots
          : (o.openPrice - livePrice) * o.lots;
        // Net K/Z = raw P&L - spread - commission - daily swap (matches trading platform)
        const fees = (o.spreadAdjustment ?? 0) + (o.commissionAmount ?? 0) + (o.swapAmount ?? 0);
        profitLoss = Math.round((rawPnl - fees) * 100) / 100;
      }
      return {
        id: o.id,
        symbol: o.symbol,
        currentPrice,
        profitLoss,
        spreadAdjustment: o.spreadAdjustment ?? 0,
        commissionAmount: o.commissionAmount ?? 0,
        swapAmount: o.swapAmount ?? 0,
        hasLivePrice: livePrice !== null,
      };
    });

    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const {
      accountType, creditEligibility, spreadPercent, commissionPercent, isAdmin,
      firstName, lastName, phone, tcNo, birthDate, city, district,
    } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (accountType !== undefined) updates.accountType = accountType;
    if (creditEligibility !== undefined) updates.creditEligibility = creditEligibility;
    if (spreadPercent !== undefined) updates.spreadPercent = Number(spreadPercent);
    if (commissionPercent !== undefined) updates.commissionPercent = Number(commissionPercent);
    if (isAdmin !== undefined) updates.isAdmin = Boolean(isAdmin);
    if (firstName !== undefined) updates.firstName = firstName.trim();
    if (lastName !== undefined) updates.lastName = lastName.trim();
    if (phone !== undefined) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone) {
        const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.phone, cleanPhone));
        if (existing && existing.id !== userId) {
          return res.status(400).json({ error: "Bad Request", message: "Bu telefon numarası başka bir hesapta kayıtlı" });
        }
        updates.phone = cleanPhone;
      }
    }
    if (tcNo !== undefined) updates.tcNo = tcNo.trim();
    if (birthDate !== undefined) updates.birthDate = birthDate.trim();
    if (city !== undefined) updates.city = city.trim();
    if (district !== undefined) updates.district = district.trim();

    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Kullanıcı güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Promote a regular user to IB status (super admin)
router.patch("/users/:id/promote-ib", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { ibReferralCode } = req.body;

    if (!ibReferralCode || !ibReferralCode.trim()) {
      return res.status(400).json({ error: "Bad Request", message: "Referans kodu zorunludur" });
    }
    const code = ibReferralCode.trim().toUpperCase();
    if (code.length < 3 || code.length > 12) {
      return res.status(400).json({ error: "Bad Request", message: "Referans kodu 3-12 karakter olmalıdır" });
    }
    if (!/^[A-Z0-9]+$/.test(code)) {
      return res.status(400).json({ error: "Bad Request", message: "Referans kodu yalnızca harf ve rakam içerebilir" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    if (user.isIB) return res.status(400).json({ error: "Bad Request", message: "Bu kullanıcı zaten IB" });

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.ibReferralCode, code));
    if (existing) return res.status(400).json({ error: "Bad Request", message: "Bu referans kodu zaten kullanımda" });

    await db.update(usersTable).set({ isIB: true, ibReferralCode: code, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true, message: `${user.firstName} ${user.lastName} IB olarak atandı. Referans kodu: ${code}`, referralCode: code });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Assign user to an IB (super admin)
router.patch("/users/:id/assign-ib", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { ibId } = req.body;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });

    if (ibId === null || ibId === undefined) {
      // Remove from IB
      await db.update(usersTable).set({ parentIbId: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
      return res.json({ success: true, message: "Kullanıcı IB bağlantısı kaldırıldı" });
    }

    const [ib] = await db.select().from(usersTable).where(eq(usersTable.id, Number(ibId)));
    if (!ib || !ib.isIB) return res.status(400).json({ error: "Bad Request", message: "Geçersiz IB hesabı" });

    await db.update(usersTable).set({ parentIbId: Number(ibId), updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true, message: `Kullanıcı ${ib.firstName} IB'sine transfer edildi` });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Admin creates a new user account (TC optional — for IB sub-accounts or manually-onboarded investors)
router.post("/users/create", async (req, res) => {
  try {
    const { firstName, lastName, password, tcNo, phone, birthDate, city, district, parentIbId, isTest } = req.body;

    // For test accounts, auto-fill required fields
    const isTestAccount = Boolean(isTest);
    const autoSuffix = Date.now().toString().slice(-5);
    const resolvedFirst = firstName?.trim() || (isTestAccount ? `Test` : "");
    const resolvedLast = lastName?.trim() || (isTestAccount ? `Hesabı ${autoSuffix}` : "");
    const resolvedPassword = password || (isTestAccount ? `test${autoSuffix}` : "");

    if (!resolvedFirst || !resolvedLast || !resolvedPassword) {
      return res.status(400).json({ error: "Bad Request", message: "Ad, soyad ve şifre zorunludur" });
    }

    // Check duplicate TC if provided
    if (tcNo && tcNo.trim()) {
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.tcNo, tcNo.trim())).limit(1);
      if (existing.length) return res.status(400).json({ error: "Bad Request", message: "Bu TC kimlik numarası ile zaten hesap mevcut" });
    }

    // Check duplicate phone if provided
    if (phone && phone.trim()) {
      const cleanPhone = phone.replace(/\D/g, "");
      const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, cleanPhone)).limit(1);
      if (existing.length) return res.status(400).json({ error: "Bad Request", message: "Bu telefon numarası ile zaten hesap mevcut" });
    }

    const accountId = generateAccountId();
    const passwordHash = hashPassword(resolvedPassword);

    const values: any = {
      firstName: resolvedFirst,
      lastName: resolvedLast,
      tcNo: tcNo?.trim() || "",
      birthDate: birthDate?.trim() || "",
      city: city?.trim() || "",
      district: district?.trim() || "",
      phone: phone ? phone.replace(/\D/g, "") || null : null,
      accountId,
      passwordHash,
      isTest: isTestAccount,
      ...(parentIbId ? { parentIbId: Number(parentIbId) } : {}),
    };

    const [user] = await db.insert(usersTable).values(values).returning();
    res.status(201).json({
      success: true,
      user: sanitizeUser(user),
      generatedPassword: isTestAccount ? resolvedPassword : undefined,
      message: `Hesap oluşturuldu. Hesap numarası: ${accountId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/users/:id/balance", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { amount, type, note } = req.body;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!users.length) {
      return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    }

    const user = users[0];
    let newBalance = user.balance;

    if (type === "add") newBalance += Number(amount);
    else if (type === "subtract") newBalance = Math.max(0, newBalance - Number(amount));
    else if (type === "set") newBalance = Number(amount);

    await db.update(usersTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    await db.insert(balanceTransactionsTable).values({
      userId,
      type: "admin_adjustment",
      amount: newBalance - user.balance,
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      description: note || `Admin bakiye düzenlemesi`,
    });

    res.json({ success: true, message: "Bakiye güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.select({
      id: ordersTable.id, userId: ordersTable.userId, symbol: ordersTable.symbol,
      stockName: ordersTable.stockName, type: ordersTable.type, direction: ordersTable.direction,
      lots: ordersTable.lots, price: ordersTable.price, limitPrice: ordersTable.limitPrice,
      totalAmount: ordersTable.totalAmount, status: ordersTable.status,
      openPrice: ordersTable.openPrice, closePrice: ordersTable.closePrice,
      profitLoss: ordersTable.profitLoss, spreadAdjustment: ordersTable.spreadAdjustment,
      commissionAmount: ordersTable.commissionAmount, createdAt: ordersTable.createdAt,
      filledAt: ordersTable.filledAt, closedAt: ordersTable.closedAt,
      firstName: usersTable.firstName, lastName: usersTable.lastName,
      accountId: usersTable.accountId, phone: usersTable.phone,
    }).from(ordersTable).leftJoin(usersTable, eq(ordersTable.userId, usersTable.id));

    let orders;
    if (status && status !== "all") {
      orders = await query.where(eq(ordersTable.status, String(status))).orderBy(desc(ordersTable.createdAt));
    } else {
      orders = await query.orderBy(desc(ordersTable.createdAt));
    }

    res.json(orders.map(o => {
      const livePrice = getLivePrice(o.symbol);
      const stock = getStock(o.symbol);
      // currentPrice for display: live > static fallback > openPrice
      const currentPrice = o.status === "open"
        ? (livePrice ?? stock?.price ?? o.openPrice ?? 0)
        : (o.closePrice ?? 0);
      // Only recompute P&L when we have a confirmed live Yahoo Finance price
      let pnl = o.profitLoss;
      if (o.status === "open" && o.openPrice && livePrice !== null) {
        const rawPnl = o.direction === "buy"
          ? (livePrice - o.openPrice) * o.lots
          : (o.openPrice - livePrice) * o.lots;
        pnl = Math.round(rawPnl * 100) / 100;
      }
      return {
        ...o, currentPrice,
        profitLoss: pnl != null ? Math.round(pnl * 100) / 100 : null,
        hasLivePrice: livePrice !== null,
        createdAt: o.createdAt.toISOString(),
        filledAt: o.filledAt?.toISOString() || null,
        closedAt: o.closedAt?.toISOString() || null,
      };
    }));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const { userId, symbol, direction, lots, openPrice } = req.body;
    if (!userId || !symbol || !direction || !lots) {
      return res.status(400).json({ error: "Bad Request", message: "Eksik alan" });
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
    if (!users.length) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    const user = users[0];
    const stock = getStock(symbol);
    const price = openPrice ? Number(openPrice) : (stock?.price || 0);
    const lotCount = Number(lots);
    const totalAmount = price * lotCount;
    if (user.balance < totalAmount) return res.status(400).json({ error: "Bad Request", message: "Kullanıcı bakiyesi yetersiz" });

    await db.update(usersTable).set({ balance: user.balance - totalAmount, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const [order] = await db.insert(ordersTable).values({
      userId: user.id, symbol, stockName: stock?.name || symbol,
      type: "market", direction, lots: lotCount,
      price, openPrice: price, totalAmount,
      status: "open", spreadAdjustment: 0, commissionAmount: 0,
    }).returning();
    await db.insert(balanceTransactionsTable).values({
      userId: user.id, type: "trade_open", amount: -totalAmount,
      balanceBefore: user.balance, balanceAfter: user.balance - totalAmount,
      description: `Admin: ${symbol} ${lotCount} lot ${direction === "buy" ? "alım" : "satım"} açıldı`,
      orderId: order.id,
    });
    res.status(201).json({ ...order, createdAt: order.createdAt.toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders/:id/cancel", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!orders.length) return res.status(404).json({ error: "Not Found", message: "İşlem bulunamadı" });
    const order = orders[0];
    if (order.status !== "open") return res.status(400).json({ error: "Bad Request", message: "Sadece açık işlemler iptal edilebilir" });

    const users = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (!users.length) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    const user = users[0];

    // Tam iade: açılışta düşülen miktar (totalAmount) + komisyon + spread (eğer negatifse)
    const refund = (order.totalAmount || 0)
      + Math.abs(order.commissionAmount || 0)
      + Math.max(0, -(order.spreadAdjustment || 0));

    const newBalance = user.balance + refund;

    await db.update(usersTable)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await db.update(ordersTable)
      .set({ status: "cancelled", closedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    await db.insert(balanceTransactionsTable).values({
      userId: user.id,
      type: "admin_adjustment",
      amount: refund,
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      description: `Admin: ${order.symbol} #${orderId} işlem iptal edildi — tam iade ${refund.toFixed(2)} ₺`,
      orderId: order.id,
    });

    res.json({ success: true, message: "İşlem iptal edildi, bakiye iade edildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders/:id/close", async (req, res) => {
  try {
    const market = checkMarketStatus();
    if (!market.open) {
      return res.status(400).json({ error: "Piyasa Kapalı", message: market.reason });
    }
    const orderId = Number(req.params.id);
    const { closePrice: manualClosePrice } = req.body;
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!orders.length) return res.status(404).json({ error: "Not Found", message: "İşlem bulunamadı" });
    const order = orders[0];
    if (order.status !== "open") return res.status(400).json({ error: "Bad Request", message: "Bu işlem zaten kapalı" });
    const users = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (!users.length) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    const user = users[0];
    const stock = getStock(order.symbol);
    const closePrice = manualClosePrice ? Number(manualClosePrice) : (stock?.price || order.openPrice || 0);
    const pnl = order.direction === "buy"
      ? (closePrice - (order.openPrice || 0)) * order.lots
      : ((order.openPrice || 0) - closePrice) * order.lots;
    const returnAmount = closePrice * order.lots;
    const newBalance = user.balance + returnAmount;
    await db.update(usersTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    const [updatedOrder] = await db.update(ordersTable).set({
      status: "closed", closePrice, profitLoss: Math.round(pnl * 100) / 100, closedAt: new Date(),
    }).where(eq(ordersTable.id, orderId)).returning();
    await db.insert(balanceTransactionsTable).values({
      userId: user.id, type: "trade_close", amount: returnAmount,
      balanceBefore: user.balance, balanceAfter: newBalance,
      description: `Admin: ${order.symbol} ${order.lots} lot kapandı - K/Z: ${pnl.toFixed(2)} ₺`,
      orderId: order.id,
    });
    res.json({ ...updatedOrder, createdAt: updatedOrder.createdAt.toISOString(), closedAt: updatedOrder.closedAt?.toISOString() || null });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/orders/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { openPrice, closePrice, direction, lots, spreadAdjustment, commissionAmount, openedAt, closedAt, profitLoss } = req.body;

    const updates: any = {};
    if (openPrice !== undefined) updates.openPrice = Number(openPrice);
    if (closePrice !== undefined) updates.closePrice = Number(closePrice);
    if (direction !== undefined) updates.direction = direction;
    if (lots !== undefined) updates.lots = Number(lots);
    if (spreadAdjustment !== undefined) updates.spreadAdjustment = Number(spreadAdjustment);
    if (commissionAmount !== undefined) updates.commissionAmount = Number(commissionAmount);
    if (profitLoss !== undefined) updates.profitLoss = Number(profitLoss);
    if (openedAt !== undefined) { updates.createdAt = parseIstanbul(openedAt); updates.filledAt = parseIstanbul(openedAt); }
    if (closedAt !== undefined) updates.closedAt = parseIstanbul(closedAt);

    await db.update(ordersTable).set(updates).where(eq(ordersTable.id, orderId));

    res.json({ success: true, message: "İşlem güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders/:id/reset-to-market", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!orders.length) return res.status(404).json({ error: "Not Found", message: "İşlem bulunamadı" });
    const order = orders[0];
    if (order.status !== "open") return res.status(400).json({ error: "Bad Request", message: "Sadece açık işlemler sıfırlanabilir" });

    const stock = getStock(order.symbol);
    const livePrice = getLivePrice(order.symbol);
    const currentPrice = livePrice ?? stock?.price;
    if (!currentPrice || currentPrice <= 0) {
      return res.status(400).json({ error: "Price Unavailable", message: `${order.symbol} için anlık fiyat alınamadı` });
    }

    const newTotalAmount = currentPrice * (order.lots || 0);
    await db.update(ordersTable).set({
      openPrice: currentPrice,
      totalAmount: newTotalAmount,
    }).where(eq(ordersTable.id, orderId));

    res.json({ success: true, symbol: order.symbol, newOpenPrice: currentPrice, newTotalAmount });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/orders/:id/reopen", async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!orders.length) return res.status(404).json({ error: "Not Found", message: "İşlem bulunamadı" });
    const order = orders[0];
    if (order.status !== "closed") return res.status(400).json({ error: "Bad Request", message: "Bu işlem zaten açık" });

    const users = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (!users.length) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    const user = users[0];

    const returnAmount = (order.closePrice || 0) * order.lots;
    const newBalance = Math.max(0, user.balance - returnAmount);
    await db.update(usersTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    await db.update(ordersTable).set({
      status: "open",
      closePrice: null,
      profitLoss: null,
      closedAt: null,
    }).where(eq(ordersTable.id, orderId));

    await db.insert(balanceTransactionsTable).values({
      userId: user.id, type: "admin_adjustment", amount: -returnAmount,
      balanceBefore: user.balance, balanceAfter: newBalance,
      description: `Admin: ${order.symbol} #${orderId} işlemi yeniden açıldı`,
      orderId: order.id,
    });

    res.json({ success: true, message: "İşlem yeniden açıldı" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/users/:id/password", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: "Bad Request", message: "Şifre en az 6 karakter olmalıdır" });
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!users.length) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });

    await db.update(usersTable)
      .set({ passwordHash: hashPassword(String(newPassword)), mustChangePassword: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Şifre güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/verify-identity/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { approved, note } = req.body;

    await db.update(usersTable).set({
      identityStatus: approved ? "approved" : "rejected",
      isIdentityVerified: approved ? true : false,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    try {
      await db.insert(notificationsTable).values({
        userId,
        title: approved ? "Kimlik Doğrulandı" : "Kimlik Reddedildi",
        body: approved ? "Kimlik belgeleriniz onaylanmıştır. Artık para çekme işlemi yapabilirsiniz." : `Kimlik belgeleriniz reddedilmiştir.${note ? ` Sebep: ${note}` : " Lütfen tekrar yükleyiniz."}`,
        type: approved ? "identity_approved" : "identity_rejected",
      });
    } catch (e) { console.error("Notification insert error:", e); }

    res.json({ success: true, message: approved ? "Kimlik onaylandı" : "Kimlik reddedildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ── Stock Registry Management ────────────────────────────────────────────────

router.get("/stocks", async (req, res) => {
  try {
    const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(10, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const stocks = await (search
      ? db.select().from(bistStocksTable).where(
          or(ilike(bistStocksTable.symbol, `%${search}%`), ilike(bistStocksTable.name, `%${search}%`))
        ).orderBy(bistStocksTable.symbol).limit(limitNum).offset(offset)
      : db.select().from(bistStocksTable).orderBy(bistStocksTable.symbol).limit(limitNum).offset(offset)
    );

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bistStocksTable);

    res.json({
      stocks,
      total: count,
      page: pageNum,
      limit: limitNum,
      liveCount: getLiveCacheSize(),
      registryCount: getRegistrySize(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/stocks", async (req, res) => {
  try {
    const { symbol, name } = req.body;
    if (!symbol || !name) return res.status(400).json({ error: "symbol ve name gerekli" });
    const upper = symbol.toUpperCase().trim();
    await db.insert(bistStocksTable).values({ symbol: upper, name: name.trim(), isAutoDiscovered: false }).onConflictDoNothing();
    await reloadRegistry();
    // Hemen fiyat çek
    fetchSymbolsNow([upper]).catch(() => {});
    res.json({ success: true, symbol: upper });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/stocks/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { name, isActive } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;
    await db.update(bistStocksTable).set(updates).where(eq(bistStocksTable.symbol, symbol));
    await reloadRegistry();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/stocks/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    await db.update(bistStocksTable).set({ isActive: false }).where(eq(bistStocksTable.symbol, symbol));
    await reloadRegistry();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/stocks/discovery/run", async (req, res) => {
  try {
    const { mode = "light" } = req.body;
    // Run in background
    import("../lib/stockDiscovery.js").then(async ({ runFullDiscovery, runLightDiscovery }) => {
      if (mode === "full") {
        await runFullDiscovery();
      } else {
        await runLightDiscovery();
      }
      await reloadRegistry();
      console.log(`[admin] Stock discovery (${mode}) completed`);
    }).catch(console.error);
    res.json({ success: true, message: `Discovery (${mode}) başlatıldı` });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/god-overview", async (_req, res) => {
  try {
    const pendingDeposits = await db.select({ count: sql<number>`count(*)::int` }).from(depositRequestsTable).where(eq(depositRequestsTable.status, "pending"));
    const pendingWithdrawals = await db.select({ count: sql<number>`count(*)::int` }).from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.status, "pending"));
    const pendingTiers = await db.select({ count: sql<number>`count(*)::int` }).from(tierApplicationsTable).where(eq(tierApplicationsTable.status, "pending"));
    const pendingIdentity = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.identityStatus, "pending"));
    const pendingMetal = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.metalApplicationStatus, "pending"));

    const allUsers = await db.select().from(usersTable);
    const totalBalance = allUsers.reduce((s, u) => s + u.balance, 0);
    const totalFrozen = allUsers.reduce((s, u) => s + u.frozenBalance, 0);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRegistrations = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${oneDayAgo}`);
    const recentTransactions = await db.select({ count: sql<number>`count(*)::int` }).from(balanceTransactionsTable).where(sql`${balanceTransactionsTable.createdAt} >= ${oneDayAgo}`);
    const recentTransactionVolume = await db.select({ total: sql<number>`COALESCE(SUM(ABS(amount)), 0)::float` }).from(balanceTransactionsTable).where(sql`${balanceTransactionsTable.createdAt} >= ${oneDayAgo}`);

    res.json({
      pendingDeposits: pendingDeposits[0]?.count || 0,
      pendingWithdrawals: pendingWithdrawals[0]?.count || 0,
      pendingTiers: pendingTiers[0]?.count || 0,
      pendingIdentity: pendingIdentity[0]?.count || 0,
      pendingMetal: pendingMetal[0]?.count || 0,
      totalUsers: allUsers.length,
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalFrozen: Math.round(totalFrozen * 100) / 100,
      last24hRegistrations: recentRegistrations[0]?.count || 0,
      last24hTransactions: recentTransactions[0]?.count || 0,
      last24hVolume: Math.round((recentTransactionVolume[0]?.total || 0) * 100) / 100,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── Spread Grup Yönetimi ────────────────────────────────────────────────────

// Tüm grupları listele
router.get("/spread-groups", async (_req, res) => {
  try {
    const groups = await db.select().from(spreadGroupsTable).orderBy(spreadGroupsTable.name);
    // Her grup için üye sayısını ekle
    const withCounts = await Promise.all(groups.map(async (g) => {
      const members = await db.select({ count: sql<number>`count(*)::int` })
        .from(usersTable).where(eq(usersTable.spreadGroupId, g.id));
      return { ...g, memberCount: members[0]?.count || 0 };
    }));
    res.json(withCounts);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Yeni grup oluştur
router.post("/spread-groups", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Bad Request", message: "Grup adı gerekli" });
    const [group] = await db.insert(spreadGroupsTable).values({
      name: name.trim(), description: description?.trim() || null
    }).returning();
    res.status(201).json(group);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Grubu güncelle
router.put("/spread-groups/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;
    const [group] = await db.update(spreadGroupsTable)
      .set({ name: name?.trim(), description: description?.trim() || null, updatedAt: new Date() })
      .where(eq(spreadGroupsTable.id, id)).returning();
    if (!group) return res.status(404).json({ error: "Not Found" });
    res.json(group);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Grubu sil
router.delete("/spread-groups/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(usersTable).set({ spreadGroupId: null }).where(eq(usersTable.spreadGroupId, id));
    await db.delete(spreadGroupsTable).where(eq(spreadGroupsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Gruba ait hisse spreadlerini getir
router.get("/spread-groups/:id/stocks", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const stocks = await db.select().from(spreadGroupStocksTable)
      .where(eq(spreadGroupStocksTable.groupId, id))
      .orderBy(spreadGroupStocksTable.symbol);
    res.json(stocks);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Gruba ait hisse spreadini güncelle (upsert)
router.put("/spread-groups/:id/stocks/:symbol", async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const symbol = req.params.symbol.toUpperCase();
    const { buySpread, sellSpread } = req.body;
    if (buySpread == null || sellSpread == null) {
      return res.status(400).json({ error: "Bad Request", message: "buySpread ve sellSpread gerekli" });
    }
    const existing = await db.select().from(spreadGroupStocksTable)
      .where(and(eq(spreadGroupStocksTable.groupId, groupId), eq(spreadGroupStocksTable.symbol, symbol)));
    let stock;
    if (existing.length > 0) {
      [stock] = await db.update(spreadGroupStocksTable)
        .set({ buySpread: Number(buySpread), sellSpread: Number(sellSpread) })
        .where(and(eq(spreadGroupStocksTable.groupId, groupId), eq(spreadGroupStocksTable.symbol, symbol)))
        .returning();
    } else {
      [stock] = await db.insert(spreadGroupStocksTable)
        .values({ groupId, symbol, buySpread: Number(buySpread), sellSpread: Number(sellSpread) })
        .returning();
    }
    res.json(stock);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Grup üyelerini getir
router.get("/spread-groups/:id/users", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const members = await db.select().from(usersTable)
      .where(eq(usersTable.spreadGroupId, id))
      .orderBy(usersTable.firstName);
    res.json(members.map(sanitizeUser));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Kullanıcıyı gruba ekle
router.post("/spread-groups/:id/users", async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Bad Request", message: "userId gerekli" });
    const group = await db.select().from(spreadGroupsTable).where(eq(spreadGroupsTable.id, groupId));
    if (!group.length) return res.status(404).json({ error: "Not Found", message: "Grup bulunamadı" });
    const [user] = await db.update(usersTable)
      .set({ spreadGroupId: groupId, updatedAt: new Date() })
      .where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    res.json(sanitizeUser(user));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Kullanıcıyı gruptan çıkar
router.delete("/spread-groups/:id/users/:userId", async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const userId = Number(req.params.userId);
    const [user] = await db.update(usersTable)
      .set({ spreadGroupId: null, updatedAt: new Date() })
      .where(and(eq(usersTable.id, userId), eq(usersTable.spreadGroupId, groupId))).returning();
    if (!user) return res.status(404).json({ error: "Not Found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── Global Stock Spreads ─────────────────────────────────────────────────────

// Tüm global spread kayıtlarını getir
router.get("/global-spreads", async (_req, res) => {
  try {
    const rows = await db.select().from(globalStockSpreadsTable).orderBy(globalStockSpreadsTable.symbol);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Bir hissenin global spreadini kaydet/güncelle (upsert)
router.put("/global-spreads/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { buySpread, sellSpread } = req.body;
    if (buySpread == null || sellSpread == null) {
      return res.status(400).json({ error: "buySpread ve sellSpread gerekli" });
    }
    const [row] = await db.insert(globalStockSpreadsTable)
      .values({ symbol, buySpread: Number(buySpread), sellSpread: Number(sellSpread) })
      .onConflictDoUpdate({
        target: globalStockSpreadsTable.symbol,
        set: { buySpread: Number(buySpread), sellSpread: Number(sellSpread), updatedAt: new Date() }
      })
      .returning();
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Bir hissenin global spreadini sıfırla (sil → default 0.5 kullanılır)
router.delete("/global-spreads/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    await db.delete(globalStockSpreadsTable).where(eq(globalStockSpreadsTable.symbol, symbol));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

export default router;
