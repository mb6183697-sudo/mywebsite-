/**
 * BIST Tam Keşif Scripti
 * 
 * Yahoo Finance search API'yi kullanarak tüm .IS sembollerini keşfeder.
 * Fiyat alınanlar → is_active=true (işlem açık)
 * Fiyat alınamayanlar → is_active=false (işlem kapalı, aramada görünür)
 */

import { db } from "@workspace/db";
import { bistStocksTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import _yfRaw from "yahoo-finance2";

const _raw = _yfRaw as any;
const _YFClass = _raw?.default?.prototype?.quote
  ? _raw.default
  : _raw?.prototype?.quote
  ? _raw
  : _raw?.default;
const yf: typeof _yfRaw = new _YFClass() as any;

// ─── Adım 1: Yahoo Finance Search API ile tüm .IS sembollerini keşfet ─────────
async function searchYahoo(query: string): Promise<string[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=tr-TR&region=TR&quotesCount=25&enableFuzzyQuery=false&newsCount=0&listsCount=0`;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });
    if (!r.ok) return [];
    const d = await r.json() as any;
    const quotes = d?.quotes || [];
    return quotes
      .filter((q: any) => q.exchange === "IST" && q.quoteType === "EQUITY" && q.symbol?.endsWith(".IS"))
      .map((q: any) => (q.symbol as string).replace(".IS", ""));
  } catch {
    return [];
  }
}

// 2-harfli tüm kombinasyonları + tek harfleri + sayılı variantları tara
const LETTERS = "ABCDEFGHIJKLMNOPRSTUVYZ".split("");
const prefixes: string[] = [];

// Tek harf
for (const l of LETTERS) prefixes.push(l);

// İki harf kombinasyonları (Türk hisselerinde yaygın)
for (const l1 of LETTERS) {
  for (const l2 of LETTERS) {
    prefixes.push(l1 + l2);
  }
}

console.log(`Toplam aranacak prefix: ${prefixes.length}`);

// ─── Adım 1: Tüm sembolleri keşfet ──────────────────────────────────────────
const discovered = new Set<string>();
let searchCount = 0;

for (let i = 0; i < prefixes.length; i++) {
  const prefix = prefixes[i];
  const found = await searchYahoo(prefix);
  for (const s of found) discovered.add(s);
  searchCount++;

  if (i % 50 === 0) {
    process.stdout.write(`\r[Arama ${i}/${prefixes.length}] Bulunan benzersiz sembol: ${discovered.size}`);
  }
  await new Promise(r => setTimeout(r, 120));
}

console.log(`\n\nKeşif tamamlandı. Toplam benzersiz sembol: ${discovered.size}`);

// Mevcut DB sembollerini yükle
const existing = await db.execute(sql`SELECT symbol FROM bist_stocks`);
const existingSet = new Set(existing.rows.map((r: any) => r.symbol as string));

const allSymbols = [...discovered];
const newSymbols = allSymbols.filter(s => !existingSet.has(s));
console.log(`Yeni (DB'de olmayan): ${newSymbols.length}`);
console.log(`Zaten var: ${allSymbols.length - newSymbols.length}`);

// ─── Adım 2: Tüm sembollerin fiyatlarını çek ────────────────────────────────
const allToCheck = [...allSymbols, ...Array.from(existingSet).filter(s => !["XAUTRYG","XAGTRYG","BRENTOIL","WTIOIL"].includes(s))];
const uniqueToCheck = [...new Set(allToCheck)].filter(s => !["XAUTRYG","XAGTRYG","BRENTOIL","WTIOIL"].includes(s));

console.log(`\nFiyat kontrol edilecek: ${uniqueToCheck.length} sembol`);

let withPrice = 0;
let noPrice = 0;
const BATCH = 40;

for (let i = 0; i < uniqueToCheck.length; i += BATCH) {
  const batch = uniqueToCheck.slice(i, i + BATCH);
  const yahooSymbols = batch.map(s => `${s}.IS`);

  try {
    const results = await yf.quote(yahooSymbols, {}, { validateResult: false });
    const arr = Array.isArray(results) ? results : [results];

    for (const q of arr) {
      if (!q || !q.symbol) continue;
      const symbol = (q.symbol as string).replace(".IS", "");
      if (["XAUTRYG","XAGTRYG","BRENTOIL","WTIOIL"].includes(symbol)) continue;

      const price = (q as any).regularMarketPrice ?? 0;
      const name = (q as any).longName || (q as any).shortName || symbol;
      const hasPrice = price > 0;

      await db.execute(sql`
        INSERT INTO bist_stocks (symbol, name, is_active, is_auto_discovered, last_price, added_at, last_seen)
        VALUES (
          ${symbol},
          ${name},
          ${hasPrice},
          true,
          ${hasPrice ? price : null},
          NOW(),
          NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
          name = CASE
            WHEN bist_stocks.name = bist_stocks.symbol THEN ${name}
            ELSE bist_stocks.name
          END,
          is_active = ${hasPrice},
          last_price = CASE WHEN ${hasPrice} THEN ${price}::numeric ELSE bist_stocks.last_price END,
          last_seen = NOW()
      `);

      if (hasPrice) withPrice++;
      else noPrice++;
    }
  } catch (e: any) {
    // silent - batch might partially fail
  }

  await new Promise(r => setTimeout(r, 300));
  process.stdout.write(
    `\r[Fiyat ${Math.min(i + BATCH, uniqueToCheck.length)}/${uniqueToCheck.length}] Aktif: ${withPrice} | Fiyatsız (pasif): ${noPrice}`
  );
}

console.log("\n\n========== TAMAMLANDI ==========");

const cnt = await db.execute(sql`
  SELECT
    COUNT(*) as toplam,
    COUNT(CASE WHEN is_active = true THEN 1 END) as aktif,
    COUNT(CASE WHEN is_active = false THEN 1 END) as pasif
  FROM bist_stocks
  WHERE symbol NOT IN ('XAUTRYG','XAGTRYG','BRENTOIL','WTIOIL')
`);

const row = cnt.rows[0] as any;
console.log(`Toplam hisse: ${row.toplam}`);
console.log(`Aktif (işlem açık, fiyatlı): ${row.aktif}`);
console.log(`Pasif (aramada görünür, işlem kapalı): ${row.pasif}`);
process.exit(0);
