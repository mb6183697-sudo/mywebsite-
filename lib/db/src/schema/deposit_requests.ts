import { pgTable, text, real, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const depositRequestsTable = pgTable("deposit_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: real("amount").notNull(),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type DepositRequest = typeof depositRequestsTable.$inferSelect;
