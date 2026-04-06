import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const depositAddressesTable = pgTable("deposit_addresses", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("bank"),
  bankName: text("bank_name"),
  accountHolder: text("account_holder"),
  accountNumber: text("account_number"),
  iban: text("iban"),
  cryptoNetwork: text("crypto_network"),
  walletAddress: text("wallet_address"),
  label: text("label"),
  note: text("note"),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DepositAddress = typeof depositAddressesTable.$inferSelect;
