import { pgTable, text, boolean, serial, timestamp } from "drizzle-orm/pg-core";

export const adminAccountsTable = pgTable("admin_accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  permissions: text("permissions").notNull().default("[]"),
  isSuper: boolean("is_super").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AdminAccount = typeof adminAccountsTable.$inferSelect;

export const ADMIN_PERMISSIONS: Record<string, string> = {
  users: "Kullanıcı Yönetimi",
  deposits: "Para Yatırma Onayı",
  withdrawals: "Para Çekme Onayı",
  campaigns: "Kampanya Yönetimi",
  tier_apps: "Tier & Hesap Başvuruları",
  notifications: "Bildirim Gönderme",
  support: "Destek Yönetimi",
  expert_picks: "Uzman Önerileri",
  stocks: "Hisse Yönetimi",
  orders: "Emir Yönetimi",
  stats: "İstatistikler",
  balance_tx_edit: "İşlem Geçmişini Düzenleme",
};
