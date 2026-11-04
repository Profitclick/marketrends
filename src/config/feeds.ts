// Feed configuration for Marketrends.no
// Canonical feed sources with batching support.
// The database (rss_feeds table) is the runtime source of truth.

export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  category: "finans" | "marked" | "teknologi" | "krypto" | "startups" | "makro";
  /** Mapped to Marketrends internal category */
  internalCategory: string;
  language: "no" | "en";
  priority: number; // 1 = highest
  maxPerRun: number;
  enabled: boolean;
}

export const FEEDS: FeedConfig[] = [
  // ── NORSKE (begrenset for unikhet – maks 3) ──
  { id: "digi", name: "Digi", url: "https://www.digi.no/rss", category: "teknologi", internalCategory: "Teknologi & AI", language: "no", priority: 1, maxPerRun: 2, enabled: true },
  { id: "tu", name: "Teknisk Ukeblad", url: "https://www.tu.no/rss", category: "teknologi", internalCategory: "Teknologi & AI", language: "no", priority: 2, maxPerRun: 2, enabled: true },
  { id: "shifter", name: "Shifter", url: "https://shifter.no/rss", category: "startups", internalCategory: "Gründer & Startups", language: "no", priority: 1, maxPerRun: 2, enabled: true },

  // ── INTERNASJONAL FINANS & MARKED ──
  { id: "reuters-biz", name: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", category: "finans", internalCategory: "Finans & Marked", language: "en", priority: 1, maxPerRun: 3, enabled: true },
  { id: "reuters-mkt", name: "Reuters Markets", url: "https://feeds.reuters.com/reuters/marketsNews", category: "marked", internalCategory: "Finans & Marked", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "marketwatch", name: "MarketWatch Top Stories", url: "https://feeds.marketwatch.com/marketwatch/topstories/", category: "finans", internalCategory: "Finans & Marked", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "cnbc", name: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "marked", internalCategory: "Finans & Marked", language: "en", priority: 3, maxPerRun: 2, enabled: true },
  { id: "ap-business", name: "AP News – Business", url: "https://apnews.com/apf-business&output=rss", category: "finans", internalCategory: "Finans & Marked", language: "en", priority: 3, maxPerRun: 2, enabled: true },

  // ── GOOGLE NEWS (GRATIS RSS) ──
  { id: "google-business", name: "Google News – Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en&gl=US&ceid=US:en", category: "finans", internalCategory: "Finans & Marked", language: "en", priority: 4, maxPerRun: 2, enabled: true },
  { id: "google-tech", name: "Google News – Technology", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en&gl=US&ceid=US:en", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 4, maxPerRun: 2, enabled: true },

  // ── TEKNOLOGI & AI ──
  { id: "theverge", name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "wired", name: "Wired", url: "https://www.wired.com/feed/rss", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 3, maxPerRun: 2, enabled: true },
  { id: "arstechnica", name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index/", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 3, maxPerRun: 2, enabled: true },
  { id: "tc-fintech", name: "TechCrunch Fintech", url: "https://techcrunch.com/category/fintech/feed/", category: "finans", internalCategory: "Finans & Marked", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "tc-startups", name: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/", category: "startups", internalCategory: "Gründer & Startups", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "venturebeat-ai", name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "zdnet", name: "ZDNet", url: "https://www.zdnet.com/rss.xml", category: "teknologi", internalCategory: "Teknologi & AI", language: "en", priority: 4, maxPerRun: 2, enabled: true },

  // ── KRYPTOVALUTA ──
  { id: "coindesk", name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "krypto", internalCategory: "Krypto & Trading", language: "en", priority: 1, maxPerRun: 3, enabled: true },
  { id: "theblock", name: "The Block", url: "https://www.theblock.co/rss.xml", category: "krypto", internalCategory: "Krypto & Trading", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "decrypt", name: "Decrypt", url: "https://decrypt.co/feed", category: "krypto", internalCategory: "Krypto & Trading", language: "en", priority: 2, maxPerRun: 2, enabled: true },
  { id: "cointelegraph", name: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "krypto", internalCategory: "Krypto & Trading", language: "en", priority: 3, maxPerRun: 2, enabled: true },
];

// Category mapping from source categories to Marketrends internal categories
export const CATEGORY_MAP: Record<string, string> = {
  finans: "Finans & Marked",
  marked: "Finans & Marked",
  teknologi: "Teknologi & AI",
  krypto: "Krypto & Trading",
  startups: "Gründer & Startups",
  makro: "Trender & Analyse",
};

// All Marketrends categories
export const CATEGORIES = [
  "Krypto & Trading",
  "Teknologi & AI",
  "Finans & Marked",
  "Gründer & Startups",
  "Penger & Karriere",
  "Trender & Analyse",
  "Guider & Forklart",
] as const;

export type MarketrendsCategory = (typeof CATEGORIES)[number];

/**
 * Get a balanced batch of feeds for a single cron run.
 * Rotates feeds by priority and balances Norwegian vs international sources.
 * @param batchSize - Number of feeds to return (default 6)
 * @param rotationOffset - Offset for rotation (e.g. based on hour or run count)
 */
export function getFeedsForBatch(
  batchSize: number = 6,
  rotationOffset: number = 0
): FeedConfig[] {
  const enabled = FEEDS.filter((f) => f.enabled);

  // Split Norwegian vs international
  const norwegian = enabled.filter((f) => f.language === "no");
  const international = enabled.filter((f) => f.language === "en");

  // Sort each group by priority (ascending = higher priority first)
  norwegian.sort((a, b) => a.priority - b.priority);
  international.sort((a, b) => a.priority - b.priority);

  // Rotate international feeds based on offset so different feeds get picked each run
  const intlLen = international.length;
  const offset = intlLen > 0 ? rotationOffset % intlLen : 0;
  const rotatedIntl = [
    ...international.slice(offset),
    ...international.slice(0, offset),
  ];

  // Always include 1-2 Norwegian feeds + fill rest with international
  const norskCount = Math.min(2, norwegian.length);
  const intlCount = batchSize - norskCount;

  const batch: FeedConfig[] = [
    ...norwegian.slice(0, norskCount),
    ...rotatedIntl.slice(0, intlCount),
  ];

  return batch.slice(0, batchSize);
}
