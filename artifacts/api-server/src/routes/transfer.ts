import { Router } from "express";
import { db, usersTable, balanceTransactionsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { getUsdTryRate } from "./stocks.js";

const router = Router();

function sanitizeAcc(u: any) {
  return {
    id: u.id,
    accountId: u.accountId,
    balance: u.balance,
    frozenBalance: u.frozenBalance ?? 0,
    balanceCurrency: u.balanceCurrency ?? "TRY",
    isMetalAccount: u.isMetalAccount ?? false,
    subAccountName: u.subAccountName ?? null,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u._role,
  };
}

/**
 * GET /api/transfer/accounts
 * Returns all accounts the current user can transfer between.
 * Works for ALL user types (normal, IB, sub-account, metal).
 */
router.get("/transfer/accounts", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    const accs: any[] = [];

    if (user.isMetalAccount && user.metalParentId) {
      const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, user.metalParentId));
      const siblings = await db.select().from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.metalParentId), eq(usersTable.isMetalAccount, true)));
      if (parent) accs.push({ ...parent, _role: "main" });
      siblings.forEach(s => accs.push({ ...s, _role: "metal" }));
    } else if (user.isIB && !user.parentIbId) {
      accs.push({ ...user, _role: "ib" });
      const subs = await db.select().from(usersTable)
        .where(and(eq(usersTable.parentIbId, user.id), isNotNull(usersTable.subAccountName)));
      subs.forEach(s => accs.push({ ...s, _role: "sub" }));
      const metals = await db.select().from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.id), eq(usersTable.isMetalAccount, true)));
      metals.forEach(m => accs.push({ ...m, _role: "metal" }));
    } else if (user.parentIbId && user.subAccountName) {
      const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, user.parentIbId));
      if (parent) accs.push({ ...parent, _role: "ib" });
      const siblings = await db.select().from(usersTable)
        .where(and(eq(usersTable.parentIbId, user.parentIbId), isNotNull(usersTable.subAccountName)));
      siblings.forEach(s => accs.push({ ...s, _role: "sub" }));
      const metals = await db.select().from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.parentIbId), eq(usersTable.isMetalAccount, true)));
      metals.forEach(m => accs.push({ ...m, _role: "metal" }));
    } else {
      accs.push({ ...user, _role: "main" });
      const metals = await db.select().from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.id), eq(usersTable.isMetalAccount, true)));
      metals.forEach(m => accs.push({ ...m, _role: "metal" }));
    }

    if (accs.length < 2) {
      return res.json({ accounts: accs.map(sanitizeAcc), usdTryRate: getUsdTryRate() });
    }

    res.json({ accounts: accs.map(sanitizeAcc), usdTryRate: getUsdTryRate() });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/**
 * POST /api/transfer
 * Body: { fromAccountId: number, toAccountId: number, amount: number }
 * Transfers balance between two accounts owned/related to the current user.
 * Handles TRY ↔ USD conversion automatically via live USDTRY rate.
 * No fees or commissions.
 */
router.post("/transfer", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    const { fromAccountId, toAccountId, amount } = req.body;

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz istek parametreleri." });
    }
    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: "Bad Request", message: "Kaynak ve hedef hesap aynı olamaz." });
    }

    const [fromAcc] = await db.select().from(usersTable).where(eq(usersTable.id, fromAccountId));
    const [toAcc] = await db.select().from(usersTable).where(eq(usersTable.id, toAccountId));

    if (!fromAcc || !toAcc) {
      return res.status(404).json({ error: "Not Found", message: "Hesap bulunamadı." });
    }

    const isAuthorized = (acc: any): boolean => {
      if (acc.id === user.id) return true;
      if (acc.metalParentId === user.id) return true;
      if (acc.metalParentId && user.metalParentId && acc.metalParentId === user.metalParentId) return true;
      if (acc.parentIbId === user.id) return true;
      if (user.parentIbId && acc.parentIbId === user.parentIbId) return true;
      if (user.parentIbId && acc.id === user.parentIbId) return true;
      if (user.isMetalAccount && user.metalParentId && acc.id === user.metalParentId) return true;
      return false;
    };

    if (!isAuthorized(fromAcc) || !isAuthorized(toAcc)) {
      return res.status(403).json({ error: "Forbidden", message: "Bu hesaplara erişim yetkiniz yok." });
    }

    const fromCurrency = fromAcc.balanceCurrency ?? "TRY";
    const toCurrency = toAcc.balanceCurrency ?? "TRY";
    const usdTryRate = getUsdTryRate();

    const availableBalance = fromAcc.balance - (fromAcc.frozenBalance ?? 0);
    if (amount > availableBalance) {
      return res.status(400).json({
        error: "Insufficient Balance",
        message: `Yetersiz bakiye. Kullanılabilir: ${availableBalance.toFixed(2)} ${fromCurrency}`,
      });
    }

    let receivedAmount: number;
    if (fromCurrency === toCurrency) {
      receivedAmount = amount;
    } else if (fromCurrency === "TRY" && toCurrency === "USD") {
      receivedAmount = amount / usdTryRate;
    } else if (fromCurrency === "USD" && toCurrency === "TRY") {
      receivedAmount = amount * usdTryRate;
    } else {
      return res.status(400).json({ error: "Bad Request", message: "Desteklenmeyen para birimi dönüşümü." });
    }

    const fromBefore = fromAcc.balance;
    const fromAfter = fromAcc.balance - amount;
    await db.update(usersTable).set({ balance: fromAfter }).where(eq(usersTable.id, fromAcc.id));
    await db.insert(balanceTransactionsTable).values({
      userId: fromAcc.id,
      type: "transfer_out",
      amount: -amount,
      balanceBefore: fromBefore,
      balanceAfter: fromAfter,
      description: `Virman: ${toAcc.subAccountName ?? (toAcc.firstName + " " + toAcc.lastName)} hesabına (${toAcc.accountId})`,
    });

    const toBefore = toAcc.balance;
    const toAfter = toAcc.balance + receivedAmount;
    await db.update(usersTable).set({ balance: toAfter }).where(eq(usersTable.id, toAcc.id));
    await db.insert(balanceTransactionsTable).values({
      userId: toAcc.id,
      type: "transfer_in",
      amount: receivedAmount,
      balanceBefore: toBefore,
      balanceAfter: toAfter,
      description: `Virman: ${fromAcc.subAccountName ?? (fromAcc.firstName + " " + fromAcc.lastName)} hesabından (${fromAcc.accountId})`,
    });

    res.json({
      success: true,
      sentAmount: amount,
      sentCurrency: fromCurrency,
      receivedAmount,
      receivedCurrency: toCurrency,
      usdTryRate: fromCurrency !== toCurrency ? usdTryRate : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

export default router;
