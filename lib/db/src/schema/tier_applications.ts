import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const tierApplicationsTable = pgTable("tier_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  requestedTier: text("requested_tier").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type TierApplication = typeof tierApplicationsTable.$inferSelect;
