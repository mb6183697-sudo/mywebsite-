import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";

export const supportChatsTable = pgTable("support_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SupportChat = typeof supportChatsTable.$inferSelect;
