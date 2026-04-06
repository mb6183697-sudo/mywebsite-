import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db, usersTable, adminAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "1000yatirimlar_secret_2024";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function generateAdminToken(adminId: number): string {
  return jwt.sign({ adminId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId?: number; adminId?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId?: number; adminId?: number };
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Token gerekli" });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Unauthorized", message: "Geçersiz token" });
  }

  if (payload.adminId) {
    const [admin] = await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.id, payload.adminId));
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized", message: "Admin hesabı bulunamadı" });
    }
    const permissions: string[] = JSON.parse(admin.permissions || "[]");
    (req as any).user = {
      id: admin.id,
      isAdmin: true,
      isAdminAccount: true,
      isSuper: admin.isSuper,
      adminPermissions: permissions,
      displayName: admin.displayName,
      username: admin.username,
      firstName: admin.displayName,
      lastName: "",
      accountType: "admin",
      balance: 0,
    };
    return next();
  }

  if (payload.userId) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!users.length) {
      return res.status(401).json({ error: "Unauthorized", message: "Kullanıcı bulunamadı" });
    }
    (req as any).user = users[0];
    return next();
  }

  return res.status(401).json({ error: "Unauthorized", message: "Geçersiz token içeriği" });
}

export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.isAdmin && !user?.isAdminAccount) {
    return res.status(403).json({ error: "Forbidden", message: "Admin yetkisi gerekli" });
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Forbidden", message: "Admin yetkisi gerekli" });
    }
    if (user.isSuper) return next();
    const perms: string[] = user.adminPermissions || [];
    if (!perms.includes(permission)) {
      return res.status(403).json({ error: "Forbidden", message: "Bu işlem için yetkiniz yok" });
    }
    next();
  };
}

export function generateAccountId(): string {
  const num = Math.floor(1000000 + Math.random() * 9000000);
  return num.toString();
}
