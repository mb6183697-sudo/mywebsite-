import { pgTable, text, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const balanceTransactionsTable = pgTable("balance_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // deposit, withdraw, trade_open, trade_close, commission, admin_adjustment
  amount: real("amount").notNull(),
  balanceBefore: real("balance_before").notNull(),
  balanceAfter: real("balance_after").notNull(),
  description: text("description"),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBalanceTransactionSchema = createInsertSchema(balanceTransactionsTable).omit({ id: true, createdAt: true });
export type InsertBalanceTransaction = z.infer<typeof insertBalanceTransactionSchema>;
export type BalanceTransaction = typeof balanceTransactionsTable.$inferSelect;
