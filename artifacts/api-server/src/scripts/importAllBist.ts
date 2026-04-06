import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { KNOWN_BIST_SYMBOLS } from "../lib/stockDiscovery.js";
import _yfRaw from "yahoo-finance2";

const _raw = _yfRaw as any;
const _YFClass = _raw?.default?.prototype?.quote
  ? _raw.default
  : _raw?.prototype?.quote
  ? _raw
  : _raw?.default;
const yf: typeof _yfRaw = new _YFClass() as any;

const unique = [...new Set(KNOWN_BIST_SYMBOLS)];
console.log(`Toplam benzersiz sembol: ${unique.length}`);
console.log("Yahoo Finance sorgulaniyor, lutfen bekleyin...\n");

let added = 0;
let skipped = 0;
const BATCH = 40;

for (let i = 0; i < unique.length; i += BATCH) {
  const batch = unique.slice(i, i + BATCH);
  const yahooSymbols = batch.map((s) => `${s}.IS`);

  try {
    const results = await yf.quote(yahooSymbols, {}, { validateResult: false });
    const arr = Array.isArray(results) ? results : [results];

    for (const q of arr) {
      if (!q || !q.symbol) continue;
      const symbol = (q.symbol as string).replace(".IS", "");
      const price = (q as any).regularMarketPrice ?? 0;
      const name = (q as any).longName || (q as any).shortName || symbol;

      if (price <= 0) {
        skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO bist_stocks (symbol, name, is_active, is_auto_discovered, last_price, added_at, last_seen)
        VALUES (${symbol}, ${name}, true, true, ${price}, NOW(), NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          name = CASE
            WHEN bist_stocks.name = bist_stocks.symbol THEN ${name}
            ELSE bist_stocks.name
          END,
          is_active = true,
          last_price = ${price},
          last_seen = NOW()
      `);
      added++;
    }
  } catch (e: any) {
    console.error(`Batch ${i}–${i + BATCH} hata: ${e.message?.slice(0, 100)}`);
  }

  await new Promise((r) => setTimeout(r, 300));
  process.stdout.write(
    `\r[${Math.min(i + BATCH, unique.length)}/${unique.length}] eklendi/guncellendi: ${added} | atlandı (fiyat yok): ${skipped}`
  );
}

console.log("\n\n========== TAMAMLANDI ==========");
console.log(`Eklenen/guncellenen: ${added}`);
console.log(`Fiyat dondurmeyenler (atlandı): ${skipped}`);

const cnt = await db.execute(sql`
  SELECT
    COUNT(*) as toplam,
    COUNT(CASE WHEN last_price > 0 THEN 1 END) as fiyatli
  FROM bist_stocks
  WHERE symbol NOT IN ('XAUTRYG','XAGTRYG','BRENTOIL','WTIOIL')
`);
console.log("Veritabani ozet:", cnt.rows[0]);
process.exit(0);
