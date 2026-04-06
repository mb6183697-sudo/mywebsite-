/**
 * Overnight Swap Job
 *
 * Charges daily swap (financing) fees for open positions held overnight.
 * Runs weekdays at 18:05 Istanbul time (5 minutes after BIST market close).
 *
 * Rule: swap is ONLY charged if the position was opened on a PREVIOUS calendar day
 * (Istanbul time). Positions opened and closed within the same day are never charged.
 */

import { db, usersTable, ordersTable, balanceTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function getIstanbulDate(date: Date = new Date()): string {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  return `${ist.getFullYear()}-${String(ist.getMonth()+1).padStart(2,"0")}-${String(ist.getDate()).padStart(2,"0")}`;
}

function getIstanbulHourMinute(): { h: number; m: number; dow: number } {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  return { h: ist.getHours(), m: ist.getMinutes(), dow: ist.getDay() };
}

async function chargeSwapFees(): Promise<void> {
  console.log("[swap] Starting overnight swap fee charge...");
  const todayIst = getIstanbulDate();

  try {
    // Get all open buy positions
    const openOrders = await db
      .select({
        id: ordersTable.id,
        userId: ordersTable.userId,
        symbol: ordersTable.symbol,
        lots: ordersTable.lots,
        openPrice: ordersTable.openPrice,
        totalAmount: ordersTable.totalAmount,
        swapAmount: ordersTable.swapAmount,
        createdAt: ordersTable.createdAt,
        direction: ordersTable.direction,
      })
      .from(ordersTable)
      .where(eq(ordersTable.status, "open"));

    let charged = 0;
    for (const order of openOrders) {
      // Only charge if position was opened on a PREVIOUS day (not today)
      const openedOnDay = getIstanbulDate(order.createdAt);
      if (openedOnDay >= todayIst) {
        continue; // Same-day position — no swap
      }

      // Get user's swap rate
      const [user] = await db
        .select({ id: usersTable.id, balance: usersTable.balance, swapPercent: usersTable.swapPercent })
        .from(usersTable)
        .where(eq(usersTable.id, order.userId));

      if (!user) continue;

      const swapRate = user.swapPercent ?? 0.03; // % per day
      const positionValue = (order.openPrice || 0) * order.lots;
      const swapFee = Math.round((positionValue * swapRate) / 100 * 100) / 100;

      if (swapFee <= 0) continue;

      const newBalance = Math.round((user.balance - swapFee) * 100) / 100;

      await db.update(usersTable)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));

      await db.update(ordersTable)
        .set({ swapAmount: Math.round(((order.swapAmount || 0) + swapFee) * 100) / 100 })
        .where(eq(ordersTable.id, order.id));

      await db.insert(balanceTransactionsTable).values({
        userId: user.id,
        type: "swap",
        amount: -swapFee,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        description: `${order.symbol} ${order.lots} lot gecelik swap (${swapRate}%)`,
        orderId: order.id,
      });

      charged++;
    }

    console.log(`[swap] Done. ${charged} position(s) charged.`);
  } catch (err: any) {
    console.error("[swap] Error during swap charge:", err.message);
  }
}

let lastRunDate = "";

export function startSwapJob(): void {
  console.log("[swap] Overnight swap job scheduled (weekdays 18:05 Istanbul).");

  setInterval(() => {
    const { h, m, dow } = getIstanbulHourMinute();
    const todayKey = getIstanbulDate();

    // Run Mon-Fri (dow 1-5) at exactly 18:05 Istanbul, once per day
    if (dow >= 1 && dow <= 5 && h === 18 && m === 5 && lastRunDate !== todayKey) {
      lastRunDate = todayKey;
      chargeSwapFees().catch(err => console.error("[swap] Unhandled error:", err));
    }
  }, 60_000); // check every minute
}
