import { pgTable, text, integer, real, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  symbol: text("symbol").notNull(),
  stockName: text("stock_name").notNull().default(""),
  type: text("type").notNull().default("market"), // market, limit
  direction: text("direction").notNull(), // buy, sell
  lots: real("lots").notNull(),
  price: real("price"), // execution price
  limitPrice: real("limit_price"),
  totalAmount: real("total_amount").notNull().default(0), // for spot: lots*openPrice; for leveraged: margin (lots*openPrice/leverage)
  status: text("status").notNull().default("open"), // pending, filled, cancelled, open, closed
  openPrice: real("open_price"),
  closePrice: real("close_price"),
  profitLoss: real("profit_loss"),
  spreadAdjustment: real("spread_adjustment").notNull().default(0),
  commissionAmount: real("commission_amount").notNull().default(0),
  swapAmount: real("swap_amount").notNull().default(0),
  leverage: integer("leverage"),  // null=spot, n=kaldıraç (ör: 200 → 1:200)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  filledAt: timestamp("filled_at"),
  closedAt: timestamp("closed_at"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
