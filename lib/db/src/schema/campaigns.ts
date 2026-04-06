import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Campaign = typeof campaignsTable.$inferSelect;
