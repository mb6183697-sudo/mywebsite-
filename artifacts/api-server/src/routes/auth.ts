import { Router } from "express";
import { db, usersTable, balanceTransactionsTable, adminAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, generateAdminToken, authMiddleware, generateAccountId } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const objectStorage = new ObjectStorageService();

const router = Router();
const upload = multer({ dest: "/tmp/uploads/" });

function validateTcNo(tc: string): boolean {
  if (!/^\d{11}$/.test(tc)) return false;
  if (tc[0] === "0") return false;
  const digits = tc.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const check10 = (oddSum * 7 - evenSum) % 10;
  if (check10 !== digits[9]) return false;
  const totalSum = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  if (totalSum % 10 !== digits[10]) return false;
  return true;
}

function validatePhone(phone: string): boolean {
  return /^5\d{9}$/.test(phone);
}

router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, tcNo, birthDate, city, district, phone, referralCode, password } = req.body;

    if (!firstName || !lastName || !tcNo || !birthDate || !phone || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Zorunlu alanları doldurunuz" });
    }

    if (!validateTcNo(tcNo)) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz TC kimlik numarası" });
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!validatePhone(normalizedPhone)) {
      return res.status(400).json({ error: "Bad Request", message: "Geçersiz telefon numarası. 5 ile başlayan 10 haneli numara giriniz" });
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Bad Request", message: "Bu telefon numarası ile zaten hesap mevcut" });
    }

    const existingTc = await db.select().from(usersTable).where(eq(usersTable.tcNo, tcNo));
    if (existingTc.length > 0) {
      return res.status(400).json({ error: "Bad Request", message: "Bu TC kimlik numarası ile zaten hesap mevcut" });
    }

    const passwordHash = hashPassword(password);
    const accountId = generateAccountId();

    // Check if referral code matches an IB's ibReferralCode → link parentIbId
    let parentIbId: number | undefined;
    if (referralCode) {
      const ibMatch = await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.ibReferralCode, referralCode.toUpperCase()))
        .limit(1);
      if (ibMatch.length > 0) parentIbId = ibMatch[0].id;
    }

    const [user] = await db.insert(usersTable).values({
      firstName,
      lastName,
      tcNo,
      birthDate,
      city: city || "",
      district: district || "",
      phone: normalizedPhone,
      referralCode,
      passwordHash,
      accountId,
      ...(parentIbId ? { parentIbId } : {}),
    }).returning();

    const token = generateToken(user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Trading app login — TC kimlik no + şifre (IB users can also use accountId)
router.post("/auth/login", async (req, res) => {
  try {
    const { tcNo, phone, accountId, password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Bad Request", message: "Şifre gerekli" });
    }

    let users: typeof usersTable.$inferSelect[] = [];

    if (accountId) {
      // Login with account number — works for all users (IB + admin-created accounts)
      users = await db.select().from(usersTable).where(eq(usersTable.accountId, String(accountId).trim()));
      if (!users.length) {
        return res.status(401).json({ error: "Unauthorized", message: "Hatalı hesap numarası veya şifre" });
      }
    } else if (tcNo) {
      const normalized = String(tcNo).replace(/\D/g, "");
      users = await db.select().from(usersTable).where(eq(usersTable.tcNo, normalized));
      if (!users.length) {
        return res.status(401).json({ error: "Unauthorized", message: "Hatalı TC kimlik no veya şifre" });
      }
    } else if (phone) {
      const normalizedPhone = String(phone).replace(/\D/g, "");
      users = await db.select().from(usersTable).where(eq(usersTable.phone, normalizedPhone));
      if (!users.length) {
        return res.status(401).json({ error: "Unauthorized", message: "Hatalı telefon veya şifre" });
      }
    } else {
      return res.status(400).json({ error: "Bad Request", message: "TC kimlik no veya hesap numarası gerekli" });
    }

    const user = users[0];
    if (!comparePassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Unauthorized", message: "Hatalı kimlik bilgileri veya şifre" });
    }

    const token = generateToken(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Admin panel login — kullanıcı adı + şifre
router.post("/auth/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Kullanıcı adı ve şifre gerekli" });
    }

    const [admin] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.username, username.trim()));
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized", message: "Hatalı kullanıcı adı veya şifre" });
    }

    if (!comparePassword(password, admin.passwordHash)) {
      return res.status(401).json({ error: "Unauthorized", message: "Hatalı kullanıcı adı veya şifre" });
    }

    const token = generateAdminToken(admin.id);
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        isSuper: admin.isSuper,
        permissions: JSON.parse(admin.permissions || "[]"),
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  const user = (req as any).user;
  if (user.isAdminAccount) {
    return res.json({
      id: user.id,
      isAdmin: true,
      isAdminAccount: true,
      isSuper: user.isSuper,
      adminPermissions: user.adminPermissions,
      displayName: user.displayName,
      username: user.username,
    });
  }
  const portfolioValue = await getUserPortfolioValue(user.id);
  let parentIbName: string | null = null;
  if (user.parentIbId) {
    const [ib] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, user.parentIbId));
    if (ib) parentIbName = `${ib.firstName} ${ib.lastName}`.trim();
  }
  res.json({ ...sanitizeUser(user), portfolioValue, totalValue: user.balance + portfolioValue, parentIbName });
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { tcNo } = req.body;
    if (!tcNo || String(tcNo).trim().length < 11) {
      return res.status(400).json({ error: "Bad Request", message: "Geçerli bir TC Kimlik No giriniz" });
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.tcNo, String(tcNo).trim()));
    if (!users.length) {
      return res.status(404).json({ error: "Not Found", message: "Bu TC Kimlik No ile kayıtlı hesap bulunamadı" });
    }
    const user = users[0];
    // 8 haneli harf+rakam kombinasyonu oluştur (karışıklık yaratacak I,l,O,0 karakterler hariç)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPw = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(tempPw), mustChangePassword: true, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
    res.json({ success: true, tempPassword: tempPw });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/auth/change-password", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.isAdminAccount) {
      return res.status(400).json({ error: "Bad Request", message: "Admin şifresini admin panelinden değiştiriniz" });
    }
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: "Bad Request", message: "Yeni şifre en az 6 karakter olmalıdır" });
    }

    // Zorunlu şifre değişikliği durumunda mevcut şifre kontrolü atlanır
    if (!user.mustChangePassword) {
      if (!comparePassword(currentPassword, user.passwordHash)) {
        return res.status(400).json({ error: "Bad Request", message: "Mevcut şifre hatalı" });
      }
    }

    await db.update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Şifre değiştirildi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.patch("/me/profile", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { firstName, lastName, phone, city, district } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (firstName !== undefined && firstName.trim()) updates.firstName = firstName.trim();
    if (lastName !== undefined && lastName.trim()) updates.lastName = lastName.trim();
    if (city !== undefined) updates.city = city.trim();
    if (district !== undefined) updates.district = district.trim();

    if (phone !== undefined) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone) {
        if (!/^5\d{9}$/.test(cleanPhone)) {
          return res.status(400).json({ error: "Bad Request", message: "Geçersiz telefon numarası (5xxxxxxxxx formatında olmalı)" });
        }
        const existing = await db.select({ id: usersTable.id }).from(usersTable)
          .where(eq(usersTable.phone, cleanPhone));
        if (existing.length > 0 && existing[0].id !== user.id) {
          return res.status(400).json({ error: "Bad Request", message: "Bu telefon numarası başka bir hesapta kayıtlı" });
        }
        updates.phone = cleanPhone;
      }
    }

    await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Profil güncellendi" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

router.post("/auth/heartbeat", authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    await db.update(usersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.post("/auth/upload-identity", authMiddleware, upload.fields([{ name: "front" }, { name: "back" }]), async (req, res) => {
  try {
    const user = (req as any).user;
    const files = req.files as any;

    const uploadToStorage = async (filePath: string): Promise<string> => {
      const buf = fs.readFileSync(filePath);
      let contentType = "image/jpeg";
      if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
      else if (buf[0] === 0x52 && buf[1] === 0x49) contentType = "image/webp";
      const objectPath = await objectStorage.uploadBuffer(buf, contentType, "identity");
      try { fs.unlinkSync(filePath); } catch {}
      return objectPath;
    };

    const frontFile = files?.front?.[0];
    const backFile = files?.back?.[0];

    const frontUrl = frontFile ? await uploadToStorage(frontFile.path) : null;
    const backUrl = backFile ? await uploadToStorage(backFile.path) : null;

    await db.update(usersTable)
      .set({
        identityStatus: "pending",
        identityFrontUrl: frontUrl,
        identityBackUrl: backUrl,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Kimlik belgesi yüklendi, onay bekleniyor" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

async function getUserPortfolioValue(userId: number): Promise<number> {
  try {
    const { db: dbConn, ordersTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const { getStock } = await import("../lib/stocks.js");

    const orders = await dbConn.select().from(ordersTable)
      .where(and(eq(ordersTable.userId, userId), eq(ordersTable.status, "open")));

    let portfolioValue = 0;
    for (const order of orders) {
      const stock = getStock(order.symbol);
      if (stock) {
        portfolioValue += stock.price * order.lots;
      }
    }
    return portfolioValue;
  } catch {
    return 0;
  }
}


export function sanitizeUser(user: any) {
  const { passwordHash, twoFASecret, twoFAEnabled, ...rest } = user;
  return rest;
}

export default router;
