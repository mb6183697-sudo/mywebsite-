import { pgTable, text, real, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: real("amount").notNull(),
  accountName: text("account_name").notNull(),
  accountAddress: text("account_address").notNull(),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type WithdrawalRequest = typeof withdrawalRequestsTable.$inferSelect;
