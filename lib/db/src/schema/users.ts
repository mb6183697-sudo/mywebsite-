import { pgTable, text, integer, boolean, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash").notNull(),
  tcNo: text("tc_no").default(""),
  birthDate: text("birth_date").default(""),
  city: text("city").notNull().default(""),
  district: text("district").notNull().default(""),
  referralCode: text("referral_code"),
  isIdentityVerified: boolean("is_identity_verified").notNull().default(false),
  identityStatus: text("identity_status").notNull().default("none"),
  identityFrontUrl: text("identity_front_url"),
  identityBackUrl: text("identity_back_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  accountType: text("account_type").notNull().default("standard"),
  creditEligibility: text("credit_eligibility").notNull().default("not_eligible"),
  balance: real("balance").notNull().default(0),
  frozenBalance: real("frozen_balance").notNull().default(0),
  spreadPercent: real("spread_percent").notNull().default(0.5),
  commissionPercent: real("commission_percent").notNull().default(0.01),
  swapPercent: real("swap_percent").notNull().default(0.03),
  twoFAEnabled: boolean("two_fa_enabled").notNull().default(false),
  twoFASecret: text("two_fa_secret"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isIB: boolean("is_ib").notNull().default(false),
  ibAuthorizedAt: timestamp("ib_authorized_at"),
  ibAllocatedBalance: real("ib_allocated_balance").notNull().default(0),
  ibReferralCode: text("ib_referral_code").unique(),
  parentIbId: integer("parent_ib_id"),
  subAccountName: text("sub_account_name"),
  isTest: boolean("is_test").notNull().default(false),
  spreadGroupId: integer("spread_group_id"),
  // Değerli Metaller Hesabı (Altın/Gümüş kaldıraçlı)
  leverage: integer("leverage"),                          // null=spot, n=kaldıraç (ör: 200)
  isMetalAccount: boolean("is_metal_account").notNull().default(false),
  metalParentId: integer("metal_parent_id"),              // ana kullanıcı ID
  metalApplicationStatus: text("metal_application_status"), // pending|approved|rejected
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  balanceCurrency: text("balance_currency").notNull().default("TRY"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
