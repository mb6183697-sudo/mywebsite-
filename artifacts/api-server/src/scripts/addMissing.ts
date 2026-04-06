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

const MISSING = [
  "KORDS","METRO","USAK","SEKFK","PRKME","MERKO","IDGYO","ENJSA","FRIGO",
  "BASCM","KRDMB","YAYLA","SEKUR","TSPOR","KSTUR","IEYHO","OTTO","ISKPL",
  "VANGD","LKMNH","TMSN","MNDRS","MERIT","TMPOL","DIRIT"
];

let added = 0, noPrice = 0;
const BATCH = 25;
const yahooSymbols = MISSING.map(s => `${s}.IS`);

const results = await yf.quote(yahooSymbols, {}, { validateResult: false });
const arr = Array.isArray(results) ? results : [results];

for (const q of arr) {
  if (!q || !(q as any).symbol) continue;
  const symbol = ((q as any).symbol as string).replace(".IS", "");
  const price = (q as any).regularMarketPrice ?? 0;
  const name = (q as any).longName || (q as any).shortName || symbol;
  const hasPrice = price > 0;

  await db.insert(bistStocksTable).values({
    symbol,
    name,
    isActive: hasPrice,
    isAutoDiscovered: true,
    lastPrice: price > 0 ? price.toString() : "0",
    addedAt: new Date(),
    lastSeen: new Date(),
  }).onConflictDoUpdate({
    target: bistStocksTable.symbol,
    set: {
      isActive: hasPrice,
      lastPrice: price > 0 ? price.toString() : undefined,
      lastSeen: new Date(),
    },
  });

  if (hasPrice) {
    added++;
    console.log(`✓ ${symbol} → ₺${price} | ${name}`);
  } else {
    noPrice++;
    console.log(`⚠ ${symbol} → fiyat yok (pasif) | ${name}`);
  }
}

console.log(`\nTamamlandı: ${added} aktif, ${noPrice} pasif eklendi.`);
process.exit(0);
