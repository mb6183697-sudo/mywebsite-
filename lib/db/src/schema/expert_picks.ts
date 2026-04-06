import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const expertPicksTable = pgTable("expert_picks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  note: text("note"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ExpertPick = typeof expertPicksTable.$inferSelect;
