import { Router } from "express";
import fs from "fs";
import { db, campaignsTable, expertPicksTable, depositAddressesTable, depositRequestsTable, withdrawalRequestsTable, tierApplicationsTable, usersTable, balanceTransactionsTable, notificationsTable, supportChatsTable, supportMessagesTable, adminAccountsTable, ADMIN_PERMISSIONS } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, requirePermission, hashPassword } from "../lib/auth.js";

import { getStock, getStockName } from "../lib/stocks.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import multer from "multer";

/** Admin formlarından gelen "YYYY-MM-DDTHH:MM" stringlerini İstanbul (UTC+3) olarak parse eder. */
function parseIstanbul(s: string): Date {
  if (!s) return new Date(NaN);
  const hasZone = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasZone ? s : s + "+03:00");
}

const objectStorage = new ObjectStorageService();

async function createNotification(userId: number, title: string, body: string, type: string = "info", imageUrl?: string | null, actionUrl?: string | null) {
  try {
    await db.insert(notificationsTable).values({ userId, title, body, type, imageUrl: imageUrl ?? null, actionUrl: actionUrl ?? null });
  } catch (e) {
    console.error("Failed to create notification:", e);
  }
}

async function broadcastNotification(title: string, body: string, type: string = "info", imageUrl?: string | null, actionUrl?: string | null) {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    await Promise.all(users.map(u => createNotification(u.id, title, body, type, imageUrl, actionUrl)));
  } catch (e) {
    console.error("Failed to broadcast notification:", e);
  }
}

const router = Router();
const upload = multer({ dest: "/tmp/uploads/" });

router.get("/deposit-addresses", authMiddleware, async (_req, res) => {
  try {
    const addresses = await db.select().from(depositAddressesTable)
      .where(eq(depositAddressesTable.isHidden, false))
      .orderBy(desc(depositAddressesTable.createdAt));
    res.json(addresses);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/admin/deposit-addresses", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const addresses = await db.select().from(depositAddressesTable).orderBy(desc(depositAddressesTable.createdAt));
    res.json(addresses);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/deposit-addresses", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type, bankName, accountHolder, accountNumber, iban, cryptoNetwork, walletAddress, label, note } = req.body;
    const [addr] = await db.insert(depositAddressesTable).values({ type, bankName, accountHolder, accountNumber, iban, cryptoNetwork, walletAddress, label, note }).returning();
    res.status(201).json(addr);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/deposit-addresses/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { bankName, accountHolder, accountNumber, iban, cryptoNetwork, walletAddress, label, note, isHidden } = req.body;
    const update: Record<string, unknown> = {};
    if (bankName !== undefined) update.bankName = bankName;
    if (accountHolder !== undefined) update.accountHolder = accountHolder;
    if (accountNumber !== undefined) update.accountNumber = accountNumber;
    if (iban !== undefined) update.iban = iban;
    if (cryptoNetwork !== undefined) update.cryptoNetwork = cryptoNetwork;
    if (walletAddress !== undefined) update.walletAddress = walletAddress;
    if (label !== undefined) update.label = label;
    if (note !== undefined) update.note = note;
    if (isHidden !== undefined) update.isHidden = isHidden;
    const [addr] = await db.update(depositAddressesTable).set(update).where(eq(depositAddressesTable.id, Number(req.params.id))).returning();
    res.json(addr);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/deposit-addresses/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.delete(depositAddressesTable).where(eq(depositAddressesTable.id, Number(req.params.id)));
    res.json({ success: true, message: "Adres silindi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/deposit-requests", authMiddleware, upload.single("receipt"), async (req, res) => {
  try {
    const user = (req as any).user;
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Bad Request", message: "Geçerli bir tutar giriniz" });
    }
    const file = (req as any).file;
    let receiptUrl: string | null = null;
    if (file) {
      const buf = fs.readFileSync(file.path);
      let contentType = "image/jpeg";
      if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
      else if (buf[0] === 0x52 && buf[1] === 0x49) contentType = "image/webp";
      else if (buf[0] === 0x25 && buf[1] === 0x50) contentType = "application/pdf";
      receiptUrl = await objectStorage.uploadBuffer(buf, contentType, "receipt");
      try { fs.unlinkSync(file.path); } catch {}
    }
    await db.insert(depositRequestsTable).values({ userId: user.id, amount, receiptUrl });
    res.status(201).json({ success: true, message: "Para yükleme talebiniz alınmıştır. Dekontunuz inceleniyor." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/admin/deposit-requests", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const requests = await db.select().from(depositRequestsTable).orderBy(desc(depositRequestsTable.createdAt));
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u]));
    const result = requests.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: userMap.get(r.userId) ? `${userMap.get(r.userId)!.firstName} ${userMap.get(r.userId)!.lastName}` : "Bilinmiyor",
      amount: r.amount,
      receiptUrl: r.receiptUrl,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() || null,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/deposit-requests/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Bad Request", message: "action must be 'approve' or 'reject'" });
    }
    const id = Number(req.params.id);
    const [request] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Not Found", message: "Talep bulunamadı" });
    if (request.status !== "pending") return res.status(400).json({ error: "Bad Request", message: "Bu talep zaten işlenmiş" });

    if (action === "approve") {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, request.userId));
      if (user) {
        const newBalance = user.balance + request.amount;
        await db.update(usersTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
        await db.insert(balanceTransactionsTable).values({
          userId: user.id, type: "deposit", amount: request.amount,
          balanceBefore: user.balance, balanceAfter: newBalance,
          description: `Para yatırma onayı - ${request.amount} ₺`,
        });

        // Auto tier upgrade based on total approved deposits
        const prevResult = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` })
          .from(depositRequestsTable)
          .where(and(eq(depositRequestsTable.userId, user.id), eq(depositRequestsTable.status, "approved")));
        const totalDeposited = (Number(prevResult[0]?.total) || 0) + request.amount;

        const tierRanks: Record<string, number> = { standard: 0, silver: 1, gold: 2, diamond: 3 };
        const getTier = (amt: number) =>
          amt >= 1_000_000 ? "diamond" : amt >= 250_000 ? "gold" : amt >= 100_000 ? "silver" : "standard";
        const newTier = getTier(totalDeposited);

        if ((tierRanks[newTier] ?? 0) > (tierRanks[user.accountType] ?? 0)) {
          const tierNames: Record<string, string> = { silver: "Gümüş", gold: "Altın", diamond: "Elmas" };
          await db.update(usersTable)
            .set({ accountType: newTier, updatedAt: new Date() })
            .where(eq(usersTable.id, user.id));
          await createNotification(
            user.id,
            "🎉 Hesabınız Yükseltildi!",
            `Toplam yatırımlarınız ${totalDeposited.toLocaleString("tr-TR")} ₺ olarak ${tierNames[newTier]} hesabına geçtiniz. Yeni avantajlarınızı profil sayfasından görebilirsiniz.`,
            "tier_approved"
          );
        }
      }
    }

    await db.update(depositRequestsTable).set({ status: action === "approve" ? "approved" : "rejected", note: note || null, processedAt: new Date() }).where(eq(depositRequestsTable.id, id));

    if (action === "approve") {
      await createNotification(request.userId, "Yatırım Onaylandı", `${request.amount.toFixed(2)} ₺ para yatırma talebiniz onaylanmış ve bakiyenize eklenmiştir.`, "deposit_approved");
    } else {
      await createNotification(request.userId, "Yatırım Reddedildi", `${request.amount.toFixed(2)} ₺ para yatırma talebiniz reddedilmiştir.${note ? ` Sebep: ${note}` : ""}`, "deposit_rejected");
    }

    res.json({ success: true, message: action === "approve" ? "Talep onaylandı" : "Talep reddedildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/withdrawal-requests", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.isIdentityVerified) {
      return res.status(403).json({ error: "Forbidden", message: "Para çekme işlemi için kimlik doğrulaması zorunludur" });
    }
    const { amount, accountName, accountAddress } = req.body;
    if (!amount || amount <= 0 || !accountName || !accountAddress) {
      return res.status(400).json({ error: "Bad Request", message: "Tüm alanları doldurunuz" });
    }
    const [freshUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
    if (!freshUser || freshUser.balance < amount) {
      return res.status(400).json({ error: "Bad Request", message: "Yetersiz bakiye" });
    }
    const newBalance = freshUser.balance - amount;
    const newFrozen = freshUser.frozenBalance + amount;
    await db.update(usersTable).set({ balance: newBalance, frozenBalance: newFrozen, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    await db.insert(withdrawalRequestsTable).values({ userId: user.id, amount, accountName, accountAddress });
    await db.insert(balanceTransactionsTable).values({
      userId: user.id, type: "withdrawal", amount: -amount,
      balanceBefore: freshUser.balance, balanceAfter: newBalance,
      description: `Para çekme talebi - ${amount} ₺ (beklemede)`,
    });
    res.status(201).json({ success: true, message: "Çekim talebiniz alınmıştır. Bakiyeniz dondurulmuştur." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/tier-application", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { tier } = req.body;
    const validTiers = ["silver", "gold", "diamond", "viop", "fon", "forex", "kripto", "halka_arz"];
    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz hesap türü" });
    }
    await db.insert(tierApplicationsTable).values({ userId: user.id, requestedTier: tier });
    res.json({ success: true, message: "Başvuru talebiniz işleme alınmıştır. Tarafınıza bilgilendirme yapılacaktır." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/account-application", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { accountType } = req.body;
    const validTypes = ["viop", "fon", "forex", "kripto", "halka_arz"];
    if (!accountType || !validTypes.includes(accountType)) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz hesap türü" });
    }
    await db.insert(tierApplicationsTable).values({ userId: user.id, requestedTier: accountType });
    res.json({ success: true, message: "Başvurunuz alınmıştır. En kısa sürede tarafınıza bilgi verilecektir." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/campaigns/upload-image", authMiddleware, adminMiddleware, upload.single("image"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "Bad Request", message: "Dosya gerekli" });
    const buf = fs.readFileSync(file.path);
    let contentType = "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
    else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
    else if (buf[0] === 0x52 && buf[1] === 0x49) contentType = "image/webp";
    const objectPath = await objectStorage.uploadBuffer(buf, contentType, "campaign");
    try { fs.unlinkSync(file.path); } catch {}
    const publicUrl = `/api/image?path=${encodeURIComponent(objectPath)}`;
    res.json({ url: publicUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    const campaigns = await db.select().from(campaignsTable).orderBy(desc(campaignsTable.createdAt));
    res.json(campaigns.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/campaigns", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, imageUrl } = req.body;
    if (!title) return res.status(400).json({ error: "Bad Request", message: "Başlık gerekli" });
    const [campaign] = await db.insert(campaignsTable).values({ title, description: description || "", imageUrl: imageUrl || null }).returning();
    res.status(201).json({ ...campaign, createdAt: campaign.createdAt.toISOString() });
    const notifBody = description ? (description.length > 100 ? description.slice(0, 100) + "…" : description) : "Yeni kampanya ve fırsatlar için detayları inceleyin.";
    broadcastNotification(`🎉 Yeni Kampanya: ${title}`, notifBody, "campaign", imageUrl || null, "/haberler");
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/campaigns/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, imageUrl } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    const [campaign] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, Number(req.params.id))).returning();
    if (!campaign) {
      return res.status(404).json({ error: "Not Found", message: "Kampanya bulunamadı" });
    }
    res.json({ ...campaign, createdAt: campaign.createdAt.toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/campaigns/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.delete(campaignsTable).where(eq(campaignsTable.id, Number(req.params.id)));
    res.json({ success: true, message: "Kampanya silindi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/expert-picks", async (_req, res) => {
  try {
    const picks = await db.select().from(expertPicksTable).orderBy(desc(expertPicksTable.createdAt));
    const result = picks.map(p => {
      const stock = getStock(p.symbol);
      return {
        id: p.id,
        symbol: p.symbol,
        note: p.note,
        logoUrl: p.logoUrl,
        stockName: stock?.name || getStockName(p.symbol),
        price: stock?.price || 0,
        change: stock?.change || 0,
        changePercent: stock?.changePercent || 0,
      };
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/expert-picks", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { symbol, note } = req.body;
    if (!symbol) return res.status(400).json({ error: "Bad Request", message: "Hisse sembolü gerekli" });
    await db.insert(expertPicksTable).values({ symbol: symbol.toUpperCase(), note: note || null });
    res.status(201).json({ success: true, message: "Uzman hissesi eklendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/expert-picks/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { note, logoUrl } = req.body;
    const updates: Record<string, any> = {};
    if (note !== undefined) updates.note = note || null;
    if (logoUrl !== undefined) updates.logoUrl = logoUrl || null;
    await db.update(expertPicksTable).set(updates).where(eq(expertPicksTable.id, Number(req.params.id)));
    res.json({ success: true, message: "Uzman hissesi güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/expert-picks/:id/logo", authMiddleware, adminMiddleware, upload.single("logo"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "Bad Request", message: "Logo dosyası gerekli" });
    const buf = fs.readFileSync(file.path);
    const contentType = file.mimetype || "image/png";
    const url = await objectStorage.uploadBuffer(buf, contentType, "expert-picks");
    fs.unlinkSync(file.path);
    await db.update(expertPicksTable).set({ logoUrl: url }).where(eq(expertPicksTable.id, Number(req.params.id)));
    res.json({ success: true, logoUrl: url });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/expert-picks/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.delete(expertPicksTable).where(eq(expertPicksTable.id, Number(req.params.id)));
    res.json({ success: true, message: "Uzman hissesi kaldırıldı" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ===== Notification Endpoints =====

router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, user.id))
      .orderBy(desc(notificationsTable.createdAt));
    res.json(notifications.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/notifications/unread-count", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
      .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)));
    res.json({ count: result[0]?.count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = Number(req.params.id);
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id)));
    res.json({ success: true, message: "Okundu" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    await db.update(notificationsTable).set({ isRead: true })
      .where(eq(notificationsTable.userId, user.id));
    res.json({ success: true, message: "Tümü okundu" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/notifications", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, body, type, userId } = req.body;
    if (!title) return res.status(400).json({ error: "Bad Request", message: "Başlık gerekli" });
    if (userId) {
      await createNotification(userId, title, body || "", type || "info");
    } else {
      const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
      for (const u of allUsers) {
        await createNotification(u.id, title, body || "", type || "broadcast");
      }
    }
    res.status(201).json({ success: true, message: "Bildirim gönderildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ===== Admin Withdrawal Requests =====

router.get("/admin/withdrawal-requests", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const requests = await db.select().from(withdrawalRequestsTable).orderBy(desc(withdrawalRequestsTable.createdAt));
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u]));
    const result = requests.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: userMap.get(r.userId) ? `${userMap.get(r.userId)!.firstName} ${userMap.get(r.userId)!.lastName}` : "Bilinmiyor",
      amount: r.amount,
      accountName: r.accountName,
      accountAddress: r.accountAddress,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() || null,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/withdrawal-requests/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Bad Request", message: "action must be 'approve' or 'reject'" });
    }
    const id = Number(req.params.id);
    const [request] = await db.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.id, id));
    if (!request) return res.status(404).json({ error: "Not Found", message: "Talep bulunamadı" });
    if (request.status !== "pending") return res.status(400).json({ error: "Bad Request", message: "Bu talep zaten işlenmiş" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, request.userId));

    if (action === "approve") {
      if (user) {
        const newFrozen = Math.max(0, user.frozenBalance - request.amount);
        await db.update(usersTable).set({ frozenBalance: newFrozen, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
      }
      await createNotification(request.userId, "Çekim Onaylandı", `${request.amount.toFixed(2)} ₺ çekim talebiniz onaylanmıştır. Hesabınıza aktarılacaktır.`, "withdrawal_approved");
    } else {
      if (user) {
        const newBalance = user.balance + request.amount;
        const newFrozen = Math.max(0, user.frozenBalance - request.amount);
        await db.update(usersTable).set({ balance: newBalance, frozenBalance: newFrozen, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
        await db.insert(balanceTransactionsTable).values({
          userId: user.id, type: "admin_adjustment", amount: request.amount,
          balanceBefore: user.balance, balanceAfter: newBalance,
          description: `Çekim talebi reddedildi - ${request.amount} ₺ iade`,
        });
      }
      await createNotification(request.userId, "Çekim Reddedildi", `${request.amount.toFixed(2)} ₺ çekim talebiniz reddedilmiştir. Bakiyeniz iade edilmiştir.${note ? ` Sebep: ${note}` : ""}`, "withdrawal_rejected");
    }

    await db.update(withdrawalRequestsTable).set({ status: action === "approve" ? "approved" : "rejected", note: note || null, processedAt: new Date() }).where(eq(withdrawalRequestsTable.id, id));
    res.json({ success: true, message: action === "approve" ? "Çekim onaylandı" : "Çekim reddedildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ===== Admin Tier Applications =====

router.get("/admin/tier-applications", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const apps = await db.select().from(tierApplicationsTable).orderBy(desc(tierApplicationsTable.createdAt));
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map(u => [u.id, u]));
    const result = apps.map(a => ({
      id: a.id,
      userId: a.userId,
      userName: userMap.get(a.userId) ? `${userMap.get(a.userId)!.firstName} ${userMap.get(a.userId)!.lastName}` : "Bilinmiyor",
      currentTier: userMap.get(a.userId)?.accountType || "standard",
      requestedTier: a.requestedTier,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      processedAt: a.processedAt?.toISOString() || null,
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/tier-applications/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Bad Request", message: "action must be 'approve' or 'reject'" });
    }
    const id = Number(req.params.id);
    const [app] = await db.select().from(tierApplicationsTable).where(eq(tierApplicationsTable.id, id));
    if (!app) return res.status(404).json({ error: "Not Found", message: "Başvuru bulunamadı" });
    if (app.status !== "pending") return res.status(400).json({ error: "Bad Request", message: "Bu başvuru zaten işlenmiş" });

    const tierNames: Record<string, string> = {
      standard: "Standart", silver: "Silver", gold: "Gold", diamond: "Diamond",
      bist: "Borsa İstanbul Yatırım Hesabı", viop: "VİOP Hesabı", fon: "Fon Hesabı",
      forex: "Forex Hesabı", kripto: "Kripto Hesabı", halka_arz: "Halka Arz Hesabı"
    };
    const isTierUpgrade = ["silver", "gold", "diamond"].includes(app.requestedTier);

    if (action === "approve") {
      if (isTierUpgrade) {
        await db.update(usersTable).set({ accountType: app.requestedTier, updatedAt: new Date() }).where(eq(usersTable.id, app.userId));
        await createNotification(app.userId, "Hesap Yükseltme Onaylandı", `Hesabınız ${tierNames[app.requestedTier] || app.requestedTier} seviyesine yükseltilmiştir.`, "tier_approved");
      } else {
        await createNotification(app.userId, "Hesap Başvurusu Onaylandı", `${tierNames[app.requestedTier] || app.requestedTier} başvurunuz onaylandı.`, "tier_approved");
      }
    } else {
      if (isTierUpgrade) {
        await createNotification(app.userId, "Hesap Yükseltme Reddedildi", `${tierNames[app.requestedTier] || app.requestedTier} seviyesine yükseltme talebiniz reddedilmiştir.`, "tier_rejected");
      } else {
        await createNotification(app.userId, "Hesap Başvurusu Reddedildi", `${tierNames[app.requestedTier] || app.requestedTier} başvurunuz reddedilmiştir.`, "tier_rejected");
      }
    }

    await db.update(tierApplicationsTable).set({ status: action === "approve" ? "approved" : "rejected", processedAt: new Date() }).where(eq(tierApplicationsTable.id, id));
    res.json({ success: true, message: action === "approve" ? "Başvuru onaylandı" : "Başvuru reddedildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/support/chats", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { category } = req.body;
    const validCategories = ["yatirim", "cekim", "teknik", "diger"];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz kategori" });
    }
    const [chat] = await db.insert(supportChatsTable).values({ userId: user.id, category }).returning();
    res.status(201).json(chat);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/support/chats/my", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const chats = await db.select().from(supportChatsTable).where(eq(supportChatsTable.userId, user.id)).orderBy(desc(supportChatsTable.updatedAt));
    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/support/chats/:id/messages", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const chatId = Number(req.params.id);
    const [chat] = await db.select().from(supportChatsTable).where(eq(supportChatsTable.id, chatId));
    if (!chat) return res.status(404).json({ error: "Not Found", message: "Sohbet bulunamadı" });
    if (chat.userId !== user.id && !user.isAdmin) return res.status(403).json({ error: "Forbidden", message: "Erişim reddedildi" });
    const messages = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.chatId, chatId)).orderBy(supportMessagesTable.createdAt);
    res.json({ chat, messages });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/support/chats/:id/messages", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const chatId = Number(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Bad Request", message: "Mesaj boş olamaz" });
    const [chat] = await db.select().from(supportChatsTable).where(eq(supportChatsTable.id, chatId));
    if (!chat) return res.status(404).json({ error: "Not Found", message: "Sohbet bulunamadı" });
    if (chat.userId !== user.id && !user.isAdmin) return res.status(403).json({ error: "Forbidden", message: "Erişim reddedildi" });
    if (chat.status === "closed" && !user.isAdmin) return res.status(400).json({ error: "Bad Request", message: "Bu sohbet kapatılmıştır" });
    const isAdmin = !!user.isAdmin;
    const [message] = await db.insert(supportMessagesTable).values({ chatId, isAdmin, content: content.trim() }).returning();
    await db.update(supportChatsTable).set({ updatedAt: new Date() }).where(eq(supportChatsTable.id, chatId));
    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/admin/support/chats", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const chats = await db
      .select({
        id: supportChatsTable.id,
        userId: supportChatsTable.userId,
        category: supportChatsTable.category,
        status: supportChatsTable.status,
        createdAt: supportChatsTable.createdAt,
        updatedAt: supportChatsTable.updatedAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        accountId: usersTable.accountId,
        phone: usersTable.phone,
      })
      .from(supportChatsTable)
      .leftJoin(usersTable, eq(supportChatsTable.userId, usersTable.id))
      .orderBy(desc(supportChatsTable.updatedAt));
    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/support/chats/:id/messages", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const admin = (req as any).user;
    const chatId = Number(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Bad Request", message: "Mesaj boş olamaz" });
    const [chat] = await db.select().from(supportChatsTable).where(eq(supportChatsTable.id, chatId));
    if (!chat) return res.status(404).json({ error: "Not Found", message: "Sohbet bulunamadı" });
    const [message] = await db.insert(supportMessagesTable).values({ chatId, isAdmin: true, content: content.trim() }).returning();
    await db.update(supportChatsTable).set({ updatedAt: new Date(), status: "open" }).where(eq(supportChatsTable.id, chatId));
    await createNotification(chat.userId, "Destek Mesajı", "Canlı destek ekibinden yeni bir mesajınız var.", "support");
    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/support/chats/:id/status", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const chatId = Number(req.params.id);
    const { status } = req.body;
    if (!["open", "closed"].includes(status)) return res.status(400).json({ error: "Bad Request", message: "Geçersiz durum" });
    await db.update(supportChatsTable).set({ status, updatedAt: new Date() }).where(eq(supportChatsTable.id, chatId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── Admin Account Management ───────────────────────────────────────────────

router.get("/admin/accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.isSuper) {
      return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin erişebilir" });
    }
    const accounts = await db.select().from(adminAccountsTable).orderBy(desc(adminAccountsTable.createdAt));
    res.json(accounts.map(a => ({
      id: a.id,
      username: a.username,
      displayName: a.displayName,
      permissions: JSON.parse(a.permissions || "[]"),
      isSuper: a.isSuper,
      createdAt: a.createdAt,
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/admin/accounts", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.isSuper) {
      return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin yeni admin ekleyebilir" });
    }
    const { username, displayName, password, permissions } = req.body;
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Kullanıcı adı, ad ve şifre gerekli" });
    }
    const existing = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.username, username.trim()));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Bad Request", message: "Bu kullanıcı adı zaten mevcut" });
    }
    const passwordHash = hashPassword(password);
    const [account] = await db.insert(adminAccountsTable).values({
      username: username.trim(),
      displayName: displayName.trim(),
      passwordHash,
      permissions: JSON.stringify(permissions || []),
      isSuper: false,
    }).returning();
    res.status(201).json({
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      permissions: JSON.parse(account.permissions || "[]"),
      isSuper: account.isSuper,
      createdAt: account.createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/accounts/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.isSuper) {
      return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin düzenleyebilir" });
    }
    const accountId = parseInt(req.params.id);
    const { displayName, password, permissions } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (displayName) updateData.displayName = displayName.trim();
    if (password) updateData.passwordHash = hashPassword(password);
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);

    const [updated] = await db.update(adminAccountsTable).set(updateData).where(eq(adminAccountsTable.id, accountId)).returning();
    if (!updated) return res.status(404).json({ error: "Not Found", message: "Admin bulunamadı" });
    res.json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      permissions: JSON.parse(updated.permissions || "[]"),
      isSuper: updated.isSuper,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/accounts/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user.isSuper) {
      return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin silebilir" });
    }
    const accountId = parseInt(req.params.id);
    if (user.id === accountId) {
      return res.status(400).json({ error: "Bad Request", message: "Kendi hesabınızı silemezsiniz" });
    }
    await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, accountId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/admin/permissions-list", authMiddleware, adminMiddleware, async (_req, res) => {
  res.json(ADMIN_PERMISSIONS);
});

// ── Balance Transaction CRUD (admin) ──────────────────────────────────────────

router.post("/admin/users/:id/balance-transactions", authMiddleware, adminMiddleware, requirePermission("balance_tx_edit"), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { amount, type, description, balanceBefore, balanceAfter, createdAt } = req.body;
    if (amount === undefined || !type) {
      return res.status(400).json({ error: "Bad Request", message: "amount ve type zorunludur" });
    }
    const insertData: Record<string, unknown> = {
      userId, type, amount: Number(amount),
      balanceBefore: balanceBefore !== undefined ? Number(balanceBefore) : 0,
      balanceAfter: balanceAfter !== undefined ? Number(balanceAfter) : 0,
      description: description || null,
    };
    if (createdAt) {
      const [row] = await db.execute(sql`
        INSERT INTO balance_transactions (user_id, type, amount, balance_before, balance_after, description, created_at)
        VALUES (${userId}, ${type}, ${Number(amount)}, ${Number(balanceBefore ?? 0)}, ${Number(balanceAfter ?? 0)}, ${description || null}, ${parseIstanbul(createdAt)})
        RETURNING *
      `);
      return res.json(row);
    }
    const [row] = await db.insert(balanceTransactionsTable).values(insertData as any).returning();
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/admin/balance-transactions/:id", authMiddleware, adminMiddleware, requirePermission("balance_tx_edit"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { amount, type, description, balanceBefore, balanceAfter, createdAt } = req.body;
    const updates: Record<string, unknown> = {};
    if (amount !== undefined) updates.amount = Number(amount);
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (balanceBefore !== undefined) updates.balanceBefore = Number(balanceBefore);
    if (balanceAfter !== undefined) updates.balanceAfter = Number(balanceAfter);
    if (createdAt) {
      await db.execute(sql`UPDATE balance_transactions SET created_at = ${parseIstanbul(createdAt)} WHERE id = ${id}`);
    }
    if (Object.keys(updates).length > 0) {
      await db.update(balanceTransactionsTable).set(updates as any).where(eq(balanceTransactionsTable.id, id));
    }
    const [row] = await db.select().from(balanceTransactionsTable).where(eq(balanceTransactionsTable.id, id));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/balance-transactions/:id", authMiddleware, adminMiddleware, requirePermission("balance_tx_edit"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(balanceTransactionsTable).where(eq(balanceTransactionsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.delete("/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser.isSuper) return res.status(403).json({ message: "Sadece süper admin kullanıcı silebilir" });
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Geçersiz kullanıcı ID" });
    // Delete all related records first
    await db.delete(supportMessagesTable).where(
      sql`chat_id IN (SELECT id FROM support_chats WHERE user_id = ${userId})`
    );
    await db.delete(supportChatsTable).where(eq(supportChatsTable.userId, userId));
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
    await db.delete(balanceTransactionsTable).where(eq(balanceTransactionsTable.userId, userId));
    await db.delete(tierApplicationsTable).where(eq(tierApplicationsTable.userId, userId));
    // orders and watchlist
    await db.execute(sql`DELETE FROM orders WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM watchlist WHERE user_id = ${userId}`);
    await db.delete(depositRequestsTable).where(eq(depositRequestsTable.userId, userId));
    await db.execute(sql`DELETE FROM withdrawal_requests WHERE user_id = ${userId}`);
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

export default router;
