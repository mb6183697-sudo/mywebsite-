import { Router } from "express";
import { db, usersTable, balanceTransactionsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, or } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";
import { generateToken, generateAccountId } from "../lib/auth.js";
import { sanitizeUser } from "./auth.js";
import { hashPassword } from "../lib/auth.js";

const router = Router();

const IB_INITIAL_BALANCE = 10_000_000; // 10 million TL
const SA_PREFIX = "SA";

function generateSubAccountId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${SA_PREFIX}${num}`;
}

// ─── Admin: IB Management ────────────────────────────────────────────────────

// List all IB users with sub-account and referred user counts (super admin only)
router.get("/admin/ib", authMiddleware, async (req: any, res) => {
  try {
    const adminUser = req.user;
    if (!adminUser?.isSuper) return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin erişebilir" });

    const ibUsers = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.isIB, true), isNull(usersTable.parentIbId)));

    const result = await Promise.all(
      ibUsers.map(async (ib) => {
        // Sub-accounts: parentIbId = ib.id
        const subs = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.parentIbId, ib.id));

        // Referred users: parentIbId = ib.id OR referralCode matches ibReferralCode
        let referredCount = subs.length;
        if (ib.ibReferralCode) {
          const referred = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.parentIbId, ib.id));
          referredCount = referred.length;
        }

        return {
          ...sanitizeUser(ib),
          subAccountCount: subs.length,
          referredCount,
        };
      })
    );

    res.json({ ibUsers: result });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// List sub-accounts + referred users of a specific IB (admin)
router.get("/admin/ib/:ibId/sub-accounts", authMiddleware, async (req: any, res) => {
  try {
    const adminUser = req.user;
    if (!adminUser?.isSuper) return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin erişebilir" });

    const ibId = parseInt(req.params.ibId);
    const [ib] = await db.select().from(usersTable).where(eq(usersTable.id, ibId));
    if (!ib) return res.status(404).json({ error: "Not Found", message: "IB bulunamadı" });

    // Sub-accounts (IB created them)
    const subAccounts = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.parentIbId, ibId));

    // Referred users: parentIbId = ibId (covers both sub-accounts and registered users with this IB's referral)
    // For separately-registered users, we query by parentIbId too (set at registration)
    const referred = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.parentIbId, ibId),
        isNull(usersTable.subAccountName)
      ));

    res.json({
      subAccounts: subAccounts.map(sanitizeUser),
      referredUsers: referred.map(sanitizeUser),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Create a new IB user directly (super admin only)
router.post("/admin/ib/create", authMiddleware, async (req: any, res) => {
  try {
    const adminUser = req.user;
    if (!adminUser?.isSuper) return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin IB oluşturabilir" });

    const { accountNumber, password, referralCode, displayName, allocatedBalance } = req.body;

    if (!accountNumber?.trim()) return res.status(400).json({ error: "Bad Request", message: "Hesap numarası zorunludur" });
    if (!password?.trim()) return res.status(400).json({ error: "Bad Request", message: "Şifre zorunludur" });
    if (!referralCode?.trim()) return res.status(400).json({ error: "Bad Request", message: "Referans kodu zorunludur" });

    const ibCode = referralCode.trim().toUpperCase();
    const ibAccountNumber = accountNumber.trim().toUpperCase();

    // Check uniqueness
    const [existingAccount] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.accountId, ibAccountNumber));
    if (existingAccount) return res.status(400).json({ error: "Bad Request", message: "Bu hesap numarası zaten kullanımda" });

    const [existingCode] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.ibReferralCode, ibCode));
    if (existingCode) return res.status(400).json({ error: "Bad Request", message: "Bu referans kodu zaten kullanımda" });

    const ibBalance = Math.max(0, Number(allocatedBalance) || IB_INITIAL_BALANCE);
    const ibName = displayName?.trim() || `IB ${ibAccountNumber}`;

    const [ibUser] = await db.insert(usersTable).values({
      accountId: ibAccountNumber,
      firstName: ibName,
      lastName: "",
      phone: `IB-${ibAccountNumber}-${Date.now()}`,
      passwordHash: hashPassword(password),
      tcNo: `IB${ibAccountNumber.replace(/[^0-9]/g, "").padEnd(9, "0").slice(0, 9)}`,
      birthDate: "01.01.1990",
      city: "",
      district: "",
      isIB: true,
      ibAuthorizedAt: new Date(),
      ibAllocatedBalance: ibBalance,
      ibReferralCode: ibCode,
      balance: ibBalance,
      accountType: "standard",
      isIdentityVerified: true,
      identityStatus: "approved",
    }).returning();

    // Record balance transaction
    await db.insert(balanceTransactionsTable).values({
      userId: ibUser.id,
      type: "admin_adjust",
      amount: ibBalance,
      balanceBefore: 0,
      balanceAfter: ibBalance,
      description: `IB hesabı oluşturuldu — havuz bakiyesi (${ibBalance.toLocaleString("tr-TR")} ₺)`,
    });

    res.status(201).json({ success: true, ibUser: sanitizeUser(ibUser), message: `IB hesabı oluşturuldu: ${ibAccountNumber}` });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Authorize an existing user as IB (super admin only)
router.post("/admin/ib/:userId/authorize", authMiddleware, async (req: any, res) => {
  try {
    const adminUser = req.user;
    if (!adminUser?.isSuper) return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin IB yetkilendirebilir" });

    const userId = parseInt(req.params.userId);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "Not Found", message: "Kullanıcı bulunamadı" });
    if (user.isIB) return res.status(400).json({ error: "Bad Request", message: "Bu kullanıcı zaten IB olarak yetkilendirilmiş" });

    const now = new Date();
    const newBalance = user.balance + IB_INITIAL_BALANCE;

    await db.update(usersTable)
      .set({ isIB: true, ibAuthorizedAt: now, ibAllocatedBalance: IB_INITIAL_BALANCE, balance: newBalance, updatedAt: now })
      .where(eq(usersTable.id, userId));

    await db.insert(balanceTransactionsTable).values({
      userId,
      type: "admin_adjust",
      amount: IB_INITIAL_BALANCE,
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      description: `IB yetkilendirme — havuz bakiyesi (${IB_INITIAL_BALANCE.toLocaleString("tr-TR")} ₺)`,
    });

    res.json({ success: true, message: `Kullanıcı IB olarak yetkilendirildi. ${IB_INITIAL_BALANCE.toLocaleString("tr-TR")} ₺ havuz bakiyesi eklendi.` });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Revoke IB status (super admin only)
router.delete("/admin/ib/:userId/revoke", authMiddleware, async (req: any, res) => {
  try {
    const adminUser = req.user;
    if (!adminUser?.isSuper) return res.status(403).json({ error: "Forbidden", message: "Sadece süper admin erişebilir" });

    const userId = parseInt(req.params.userId);
    await db.update(usersTable)
      .set({ isIB: false, ibAuthorizedAt: null, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// ─── IB User: Sub-account Management ─────────────────────────────────────────

/**
 * GET /ib/my-accounts
 * Returns all accounts the current user can switch between:
 *   - IB user: self + all sub-accounts
 *   - Sub-account user: parent IB + all sibling sub-accounts
 *   - Any user: metal sub-accounts (Değerli Metaller Hesapları)
 */
router.get("/ib/my-accounts", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    let accounts: any[] = [];

    // Metal hesap sahibi: ana hesabına dön
    if (user.isMetalAccount && user.metalParentId) {
      const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, user.metalParentId));
      const siblings = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.metalParentId), eq(usersTable.isMetalAccount, true)));
      accounts = [
        ...(parent ? [{ ...sanitizeUser(parent), isCurrentAccount: false, role: "main" }] : []),
        ...siblings.map(s => ({ ...sanitizeUser(s), isCurrentAccount: s.id === user.id, role: "metal" })),
      ];
      return res.json({ accounts });
    }

    if (user.isIB && !user.parentIbId) {
      // IB account: self + sub-accounts
      const subs = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.parentIbId, user.id), isNotNull(usersTable.subAccountName)));
      accounts = [
        { ...sanitizeUser(user), isCurrentAccount: true, role: "ib" },
        ...subs.map(s => ({ ...sanitizeUser(s), isCurrentAccount: false, role: "sub" })),
      ];
    } else if (user.parentIbId && user.subAccountName) {
      // IB tarafından oluşturulan alt hesap: parent IB + kardeş alt hesaplar
      // NOT: Sadece referans koduyla kaydolan kullanıcılar (subAccountName yok) buraya girmez
      const [parent] = await db.select().from(usersTable).where(eq(usersTable.id, user.parentIbId));
      const siblings = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.parentIbId, user.parentIbId), isNotNull(usersTable.subAccountName)));
      accounts = [
        ...(parent ? [{ ...sanitizeUser(parent), isCurrentAccount: false, role: "ib" }] : []),
        ...siblings.map(s => ({ ...sanitizeUser(s), isCurrentAccount: s.id === user.id, role: "sub" })),
      ];
    } else {
      // Normal user — check for metal sub-accounts only
      const metalAccounts = await db.select().from(usersTable)
        .where(and(eq(usersTable.metalParentId, user.id), eq(usersTable.isMetalAccount, true)));
      if (metalAccounts.length === 0) {
        return res.status(403).json({ error: "Forbidden", message: "Bu özellik sadece IB ve alt hesaplar için" });
      }
      accounts = [
        { ...sanitizeUser(user), isCurrentAccount: true, role: "main" },
        ...metalAccounts.map(m => ({ ...sanitizeUser(m), isCurrentAccount: false, role: "metal" })),
      ];
      return res.json({ accounts });
    }

    // IB/sub-accounts — also append metal accounts if any
    const metalAccounts = await db.select().from(usersTable)
      .where(and(eq(usersTable.metalParentId, user.id), eq(usersTable.isMetalAccount, true)));
    const metalEntries = metalAccounts.map(m => ({ ...sanitizeUser(m), isCurrentAccount: false, role: "metal" }));

    res.json({ accounts: [...accounts, ...metalEntries] });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

/**
 * POST /ib/switch/:targetId
 * Universal switch: allows IB ↔ sub-account, sub ↔ sibling, and main ↔ metal sub-account.
 */
router.post("/ib/switch/:targetId", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    const targetId = parseInt(req.params.targetId);

    if (user.id === targetId) {
      return res.status(400).json({ error: "Bad Request", message: "Zaten bu hesap aktif" });
    }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
    if (!target) return res.status(404).json({ error: "Not Found", message: "Hesap bulunamadı" });

    // Authorization check
    let authorized = false;

    // Metal hesap geçişi: ana hesap ↔ metal sub-account
    if (user.isMetalAccount && user.metalParentId) {
      // Metal hesabı: ana hesaba veya aynı ana hesabın diğer metal sub-account'ına geçiş
      if (target.id === user.metalParentId) authorized = true;
      else if (target.metalParentId === user.metalParentId && target.isMetalAccount) authorized = true;
    } else if (!user.isMetalAccount) {
      // Normal kullanıcı: kendi metal sub-account'ına geçiş
      if (target.metalParentId === user.id && target.isMetalAccount) authorized = true;
    }

    // IB/sub-account geçişleri
    if (!authorized) {
      if (user.isIB && !user.parentIbId) {
        authorized = target.parentIbId === user.id;
      } else if (user.parentIbId && user.subAccountName) {
        // Yalnızca IB tarafından oluşturulan alt hesaplar (subAccountName dolu)
        // parent IB'ye veya kardeş alt hesaplara geçebilir.
        // Referans koduyla kaydolan normal kullanıcılar (subAccountName = null) buraya giremez.
        if (target.id === user.parentIbId) authorized = true;
        else if (target.parentIbId === user.parentIbId && target.subAccountName) authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: "Forbidden", message: "Bu hesaba geçiş yetkiniz yok" });
    }

    const token = generateToken(target.id);
    res.json({ token, account: sanitizeUser(target) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// List own sub-accounts (only directly created sub-accounts, NOT referral users)
router.get("/ib/sub-accounts", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user.isIB) return res.status(403).json({ error: "Forbidden", message: "Sadece IB hesapları alt hesap yönetebilir" });

    const subs = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.parentIbId, user.id), isNotNull(usersTable.subAccountName)));

    res.json({ subAccounts: subs.map(sanitizeUser) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Create a new sub-account
router.post("/ib/sub-accounts", authMiddleware, async (req: any, res) => {
  try {
    const ib = req.user;
    if (!ib.isIB) return res.status(403).json({ error: "Forbidden", message: "Sadece IB hesapları alt hesap oluşturabilir" });

    // isTest default true — IB'nin panelden açtığı hesaplar test hesabıdır
    const { accountName, initialBalance, isTest = true } = req.body;
    if (!accountName?.trim()) return res.status(400).json({ error: "Bad Request", message: "Hesap adı zorunludur" });

    let subAccountId = generateSubAccountId();
    let attempt = 0;
    while (attempt < 10) {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.accountId, subAccountId));
      if (!existing) break;
      subAccountId = generateSubAccountId();
      attempt++;
    }

    const initBalance = Math.max(0, Number(initialBalance) || 0);

    const [subAccount] = await db.insert(usersTable).values({
      accountId: subAccountId,
      firstName: accountName.trim(),
      lastName: `(IB Alt Hesap)`,
      phone: `IB${ib.id}-${Date.now()}`,
      passwordHash: hashPassword(Math.random().toString(36)),
      tcNo: `IB${ib.id}${Date.now().toString().slice(-5)}`,
      birthDate: "01.01.2000",
      city: ib.city || "",
      district: ib.district || "",
      isIB: false,
      isTest: Boolean(isTest),
      parentIbId: ib.id,
      subAccountName: accountName.trim(),
      balance: initBalance,
      accountType: "standard",
      isIdentityVerified: true,
      identityStatus: "approved",
    }).returning();

    res.status(201).json({ subAccount: sanitizeUser(subAccount) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

// Get access token for a sub-account (IB switches to it)
router.post("/ib/sub-accounts/:id/access", authMiddleware, async (req: any, res) => {
  try {
    const ib = req.user;
    if (!ib.isIB) return res.status(403).json({ error: "Forbidden", message: "Sadece IB hesapları alt hesaplara erişebilir" });

    const subId = parseInt(req.params.id);
    const [subAccount] = await db.select().from(usersTable).where(
      and(eq(usersTable.id, subId), eq(usersTable.parentIbId, ib.id))
    );
    if (!subAccount) return res.status(404).json({ error: "Not Found", message: "Alt hesap bulunamadı" });

    const token = generateToken(subAccount.id);
    res.json({ token, subAccount: sanitizeUser(subAccount) });
  } catch (err: any) {
    res.status(500).json({ error: "Internal Error", message: err.message });
  }
});

export default router;
