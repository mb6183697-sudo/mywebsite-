import { db } from "@workspace/db";
import { bistStocksTable } from "@workspace/db";
import _yfRaw from "yahoo-finance2";

const _raw = _yfRaw as any;
const _YFClass = _raw?.default?.prototype?.quote
  ? _raw.default
  : _raw?.prototype?.quote
  ? _raw
  : _raw?.default;
const yf: typeof _yfRaw = new _YFClass() as any;

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("Kullanım: tsx addSymbol.ts SEMBOL");
  process.exit(1);
}

const q = await yf.quote(`${symbol}.IS`, {}, { validateResult: false }) as any;
const price = q?.regularMarketPrice ?? 0;
const name = q?.longName || q?.shortName || symbol;

console.log(`Yahoo Finance: ${symbol} → ${price} TL | ${name}`);

await db.insert(bistStocksTable).values({
  symbol,
  name,
  isActive: true,
  isAutoDiscovered: true,
  lastPrice: price > 0 ? price.toString() : "0",
  addedAt: new Date(),
  lastSeen: new Date(),
}).onConflictDoUpdate({
  target: bistStocksTable.symbol,
  set: {
    isActive: true,
    lastPrice: price > 0 ? price.toString() : undefined,
    lastSeen: new Date(),
  },
});

console.log(`✓ ${symbol} veritabanına eklendi/güncellendi.`);
process.exit(0);
