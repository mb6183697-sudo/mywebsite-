import { pgTable, text, integer, boolean, serial, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  imageUrl: text("image_url"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
