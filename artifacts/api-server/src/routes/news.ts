import { Router } from "express";
import { authMiddleware } from "../lib/auth.js";
import https from "https";
import http from "http";

const router = Router();

interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  publishedAt: string;
  category?: string;
  imageUrl?: string;
}

let newsCache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 1000;

function fetchUrl(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 4) return reject(new Error("Too many redirects"));
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; fin-news-bot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        return fetchUrl(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(7000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function extractText(tag: string, xml: string): string {
  const cdataMatch = new RegExp(`<${tag}>[\\s\\S]*?<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[\\s\\S]*?<\\/${tag}>`).exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return plainMatch ? plainMatch[1].replace(/<[^>]+>/g, "").trim() : "";
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractImage(itemXml: string): string | undefined {
  const patterns = [
    /media:thumbnail[^>]+url="([^"]+)"/,
    /media:content[^>]+url="([^"]+)"/,
    /enclosure[^>]+url="([^"]+)"[^>]+type="image/,
    /enclosure[^>]+type="image[^"]*"[^>]+url="([^"]+)"/,
    /<img[^>]+src="(https?:\/\/[^"]+)"/,
  ];
  for (const p of patterns) {
    const m = p.exec(itemXml);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function parseRss(xml: string, source: string, category: string, limit = 8): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const chunk = m[1];
    const title = decodeHtml(extractText("title", chunk));
    if (!title || title.toLowerCase().includes("google")) continue;
    const link = extractText("link", chunk) || extractText("guid", chunk);
    const pubDate = extractText("pubDate", chunk);
    const desc = decodeHtml(extractText("description", chunk)).replace(/<[^>]+>/g, "").slice(0, 200);
    const imageUrl = extractImage(chunk);
    let publishedAt = new Date().toISOString();
    try { if (pubDate) publishedAt = new Date(pubDate).toISOString(); } catch {}
    items.push({
      id: `${source.replace(/\s/g, "_")}-${idx++}`,
      title,
      summary: desc || undefined,
      url: link || undefined,
      source,
      publishedAt,
      category,
      imageUrl,
    });
  }
  return items;
}

const RSS_SOURCES = [
  { url: "https://news.google.com/rss/search?q=BIST+borsa+istanbul+hisse+senedi&hl=tr&gl=TR&ceid=TR:tr", source: "Google Haberler", category: "BIST" },
  { url: "https://news.google.com/rss/search?q=türkiye+ekonomi+merkez+bankası+faiz&hl=tr&gl=TR&ceid=TR:tr", source: "Google Haberler", category: "Ekonomi" },
  { url: "https://news.google.com/rss/search?q=dolar+euro+türk+lirası+kur&hl=tr&gl=TR&ceid=TR:tr", source: "Google Haberler", category: "Kur" },
  { url: "https://news.google.com/rss/search?q=THYAO+EREGL+AKBNK+GARAN+hisse&hl=tr&gl=TR&ceid=TR:tr", source: "Google Haberler", category: "Şirket Haberleri" },
  { url: "https://www.bloomberght.com/rss", source: "Bloomberg HT", category: "Ekonomi" },
  { url: "https://tr.investing.com/rss/news.rss", source: "Investing.com", category: "Ekonomi" },
];

const FALLBACK_NEWS: NewsItem[] = [
  { id: "fb1", title: "BIST 100 Piyasa Günlüğü", summary: "Borsa İstanbul günlük işlem özeti için anlık verileri takip edin.", source: "Sistem", publishedAt: new Date(Date.now() - 5 * 60000).toISOString(), category: "BIST" },
  { id: "fb2", title: "Dolar/TL ve Euro/TL Kur Takibi", summary: "Türk Lirası kur hareketlerini ve merkez bankası açıklamalarını izleyin.", source: "Sistem", publishedAt: new Date(Date.now() - 20 * 60000).toISOString(), category: "Kur" },
  { id: "fb3", title: "Türkiye Ekonomi Haberleri", summary: "Güncel enflasyon, büyüme ve dış ticaret verileri piyasaları etkiliyor.", source: "Sistem", publishedAt: new Date(Date.now() - 40 * 60000).toISOString(), category: "Ekonomi" },
];

async function fetchAllNews(): Promise<NewsItem[]> {
  const promises = RSS_SOURCES.map(async ({ url, source, category }) => {
    try {
      const xml = await Promise.race([
        fetchUrl(url),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
      ]);
      return parseRss(xml, source, category, 6);
    } catch (e) {
      console.warn(`[news] Skipping ${source} (${url.slice(0, 60)}...): ${(e as Error).message}`);
      return [];
    }
  });

  const results = await Promise.all(promises);
  const all = results.flat();

  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return deduped.length >= 3 ? deduped : FALLBACK_NEWS;
}

router.get("/news", authMiddleware, async (_req, res) => {
  try {
    const now = Date.now();
    if (newsCache && now - newsCache.fetchedAt < CACHE_TTL_MS) {
      return res.json(newsCache.items);
    }
    const items = await fetchAllNews();
    newsCache = { items, fetchedAt: now };
    res.json(items);
  } catch (err: any) {
    if (newsCache) return res.json(newsCache.items);
    res.json(FALLBACK_NEWS);
  }
});

export default router;
