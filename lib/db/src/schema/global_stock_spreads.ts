import { pgTable, serial, varchar, real, timestamp } from "drizzle-orm/pg-core";

export const globalStockSpreadsTable = pgTable("global_stock_spreads", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  buySpread: real("buy_spread").notNull().default(0.5),
  sellSpread: real("sell_spread").notNull().default(0.5),
  updatedAt: timestamp("updated_at").defaultNow(),
});
