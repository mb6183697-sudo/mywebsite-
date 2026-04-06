import { pgTable, text, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const bistStocksTable = pgTable("bist_stocks", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isAutoDiscovered: boolean("is_auto_discovered").default(false).notNull(),
  lastPrice: real("last_price"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow(),
});
