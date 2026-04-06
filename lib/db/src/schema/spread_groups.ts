import { pgTable, text, serial, integer, real, timestamp, unique } from "drizzle-orm/pg-core";

export const spreadGroupsTable = pgTable("spread_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const spreadGroupStocksTable = pgTable("spread_group_stocks", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => spreadGroupsTable.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  buySpread: real("buy_spread").notNull().default(0.5),
  sellSpread: real("sell_spread").notNull().default(0.5),
}, (t) => [unique("uniq_group_symbol").on(t.groupId, t.symbol)]);

export type SpreadGroup = typeof spreadGroupsTable.$inferSelect;
export type SpreadGroupStock = typeof spreadGroupStocksTable.$inferSelect;
