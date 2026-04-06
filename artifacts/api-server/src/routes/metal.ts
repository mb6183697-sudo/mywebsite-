/**
 * Değerli Metaller Hesabı (Altın/Gümüş) — metal sub-account management
 *
 * POST   /metal/apply                      — kullanıcı metal hesap başvurusu yapar
 * GET    /admin/metal-applications          — admin: tüm başvuruları listele
 * POST   /admin/metal-applications/:userId/approve  — admin: onayla + sub-account oluştur
 * POST   /admin/metal-applications/:userId/reject   — admin: reddet
 * GET    /metal/accounts                   — kullanıcının metal hesaplarını listele
 */

import { Router } from "express";
import { db, usersTable, balanceTransactionsTable, ordersTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { getLivePrice } from "../lib/stocks.js";
import { authMiddleware, adminMiddleware } from "../lib/auth.js";
import { generateToken } from "../lib/auth.js";
import { sanitizeUser } from "./auth.js";
import { hashPassword } from "../lib/auth.js";

const router = Router();

const METAL_LEVERAGE = 200; // 1:200

function generateMetalAccountId(): string {
  const num = Math.floor(1000000 + Math.random() * 9000000);
  return `MT${num}`;
}

// ─── Kullanıcı: Metal hesap başvurusu ─────────────────────────────────────────

/**
 * POST /metal/apply
 * Mevcut kullanıcı metal hesap başvurusu gönderir.
 * Koşullar: kimlik onaylı, daha önce başvuru yapmamış veya reddedilmiş.
 */
router.post("/metal/apply", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;

    if (!user.isIdentityVerified) {
      return res.status(403).json({ error: "Forbidden", message: "Değerli metaller hesabı için kimlik doğrulaması gerekli" });
    }

    if (user.isMetalAccount) {
      return res.status(400).json({ error: "Bad Request", message: "Bu zaten bir değerli metaller hesabı" });
    }

    // Metal parent check — zaten metal hesabı olan hesabın ana hesabı başvuru yapamaz (sadece normal hesaplar)
    if (user.metalParentId) {
      return res.status(400).json({ error: "Bad Request", message: "Metal hesap sahibi ek başvuru yapamaz" });
    }

    // Check existing application
    const existingStatus = user.metalApplicationStatus;
    if (existingStatus === "pending") {
      return res.status(400).json({ error: "Bad Request", message: "Değerli metaller hesabı başvurunuz inceleme aşamasında" });
    }
    if (existingStatus === "approved") {
      return res.status(400).json({ error: "Bad Request", message: "Değerli metaller hesabınız zaten onaylandı" });
    }

    // Set application status to pending
    await db.update(usersTable)
      .set({ metalApplicationStatus: "pending", updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Değerli metaller hesabı başvurunuz alındı. En kısa sürede incelenecektir." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/**
 * GET /metal/accounts
 * Kullanıcının metal sub-account'larını listeler.
 */
router.get("/metal/accounts", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;

    const metalAccounts = await db.select().from(usersTable)
      .where(and(eq(usersTable.metalParentId, user.id), eq(usersTable.isMetalAccount, true)));

    res.json({ metalAccounts: metalAccounts.map(sanitizeUser) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── Admin: Aktif metal hesaplar ──────────────────────────────────────────────

/**
 * GET /admin/metal-accounts
 * Tüm isMetalAccount=true hesapları listeler, portfolio metrikleri ile birlikte.
 */
router.get("/admin/metal-accounts", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const metalAccounts = await db.select().from(usersTable)
      .where(eq(usersTable.isMetalAccount, true));

    const result = await Promise.all(metalAccounts.map(async acc => {
      let equity: number | undefined;
      let usedMargin: number | undefined;
      let freeMargin: number | undefined;
      let marginLevel: number | undefined;

      try {
        const leverage = acc.leverage ?? 200;
        const openOrders = await db.select().from(ordersTable)
          .where(and(eq(ordersTable.userId, acc.id), eq(ordersTable.status, "open")));

        let floatingPnL = 0;
        let totalUsedMargin = 0;

        const CONTRACT_SIZES: Record<string, number> = {
          XAUTRYG: 100, XAGTRYG: 5000, BRENTOIL: 1000, WTIOIL: 1000,
        };
        for (const order of openOrders) {
          const livePrice = getLivePrice(order.symbol) ?? order.openPrice;
          const lots = order.lots;
          const contractSize = CONTRACT_SIZES[order.symbol] ?? 1;
          const direction = order.direction as "buy" | "sell";
          const rawPnL = direction === "buy"
            ? (livePrice - order.openPrice) * lots * contractSize
            : (order.openPrice - livePrice) * lots * contractSize;
          floatingPnL += rawPnL;
          totalUsedMargin += (order.openPrice * lots * contractSize) / leverage;
        }

        const bal = acc.balance;
        equity = bal + floatingPnL;
        usedMargin = totalUsedMargin;
        freeMargin = equity - usedMargin;
        marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : undefined;
      } catch {}

      // Ana hesap adını getir
      let parentName: string | undefined;
      if (acc.metalParentId) {
        const [parent] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable).where(eq(usersTable.id, acc.metalParentId));
        if (parent) parentName = `${parent.firstName} ${parent.lastName}`;
      }

      return {
        ...sanitizeUser(acc),
        isMetalAccount: acc.isMetalAccount,
        leverage: acc.leverage,
        metalParentId: acc.metalParentId,
        parentName,
        equity,
        usedMargin,
        freeMargin,
        marginLevel,
      };
    }));

    res.json({ accounts: result });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── Admin: Metal başvuruları ──────────────────────────────────────────────────

/**
 * GET /admin/metal-applications
 * Tüm metal hesap başvurularını listeler (pending/approved/rejected).
 */
router.get("/admin/metal-applications", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const { status } = req.query;

    const applicants = await db.select().from(usersTable)
      .where(isNotNull(usersTable.metalApplicationStatus));

    let filtered = applicants;
    if (status === "pending") filtered = applicants.filter(u => u.metalApplicationStatus === "pending");
    else if (status === "approved") filtered = applicants.filter(u => u.metalApplicationStatus === "approved");
    else if (status === "rejected") filtered = applicants.filter(u => u.metalApplicationStatus === "rejected");

    // Enrich with metal sub-account info
    const result = await Promise.all(filtered.map(async (u) => {
      const metalAccounts = await db.select({ id: usersTable.id, accountId: usersTable.accountId })
        .from(usersTable)
        .where(and(eq(usersTable.metalParentId, u.id), eq(usersTable.isMetalAccount, true)));
      return {
        ...sanitizeUser(u),
        metalApplicationStatus: u.metalApplicationStatus,
        metalAccountCount: metalAccounts.length,
        metalAccountIds: metalAccounts.map(m => m.accountId),
      };
    }));

    res.json({ applications: result });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/**
 * POST /admin/metal-applications/:userId/approve
 * Başvuruyu onaylar ve kullanıcı için 4 metal sub-account oluşturur:
 * XAUTRYG (Altın), XAGTRYG (Gümüş), BRENTOIL (Brent), WTIOIL (WTI)
 */
router.post("/admin/metal-applications/:userId/approve", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const [applicant] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!applicant) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });

    // Eğer zaten onaylandıysa ama metal hesap yoksa → eksik hesabı oluşturmaya izin ver (orphan fix)
    const existingMetal = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.metalParentId, userId), eq(usersTable.isMetalAccount, true)));

    if (applicant.metalApplicationStatus === "approved" && existingMetal.length > 0) {
      return res.status(400).json({ error: "Bad Request", message: "Metal hesap zaten mevcut" });
    }

    if (applicant.metalApplicationStatus !== "pending" && applicant.metalApplicationStatus !== "approved") {
      return res.status(400).json({ error: "Bad Request", message: "Bu başvuru pending durumda değil" });
    }

    // Tek bir Değerli Metaller & Emtia hesabı oluştur (USD bakiyeli, 1:200 kaldıraç)
    // Bu hesap üzerinden XAUTRYG, XAGTRYG, BRENTOIL ve WTIOIL işlemi yapılabilir.
    let metalAccountId = generateMetalAccountId();
    let attempt = 0;
    while (attempt < 10) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.accountId, metalAccountId));
      if (!existing) break;
      metalAccountId = generateMetalAccountId();
      attempt++;
    }

    const [metalAccount] = await db.insert(usersTable).values({
      accountId: metalAccountId,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      phone: `MT-${applicant.id}-${Date.now()}`,
      passwordHash: applicant.passwordHash,
      tcNo: `MT${applicant.id}${Date.now().toString().slice(-5)}`,
      birthDate: applicant.birthDate || "01.01.1990",
      city: applicant.city || "",
      district: applicant.district || "",
      isMetalAccount: true,
      leverage: METAL_LEVERAGE,
      metalParentId: applicant.id,
      subAccountName: "Değerli Metaller & Emtia",
      balance: 0,
      balanceCurrency: "USD",
      accountType: "standard",
      isIdentityVerified: true,
      identityStatus: "approved",
      spreadPercent: applicant.spreadPercent ?? 0.5,
      commissionPercent: applicant.commissionPercent ?? 0.01,
    }).returning();

    // Ana kullanıcının başvuru durumunu güncelle
    await db.update(usersTable)
      .set({ metalApplicationStatus: "approved", updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.status(201).json({
      success: true,
      message: `Değerli Metaller & Emtia hesabı oluşturuldu (${metalAccountId})`,
      metalAccount: sanitizeUser(metalAccount),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/**
 * POST /admin/metal-applications/:userId/reject
 * Başvuruyu reddeder.
 */
router.post("/admin/metal-applications/:userId/reject", authMiddleware, adminMiddleware, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason } = req.body;

    const [applicant] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!applicant) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });

    await db.update(usersTable)
      .set({ metalApplicationStatus: "rejected", updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Başvuru reddedildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

export default router;
