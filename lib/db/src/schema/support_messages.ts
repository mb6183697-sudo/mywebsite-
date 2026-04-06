import { pgTable, text, integer, boolean, serial, timestamp } from "drizzle-orm/pg-core";

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SupportMessage = typeof supportMessagesTable.$inferSelect;
