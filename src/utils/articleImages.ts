import { getCategoryFallbackImage } from "./seo";

export interface ArticleImageInput {
  id: string;
  title: string;
  category: string;
  image_url?: string | null;
  tags?: string[] | null;
}

export interface ResolvedArticleImage {
  src: string;
  fallbackSrc: string;
  usedFallback: boolean;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=1200&h=675&fit=crop`;

// Extra documentary photography keeps large category feeds from cycling through
// the same small fallback set. Original article photography always wins.
const SUPPLEMENTAL_IMAGES: Record<string, string[]> = {
  "Teknologi & AI": [
    "photo-1677442136019-21780ecad995",
    "photo-1620712943543-bcc4688e7485",
    "photo-1485827404703-89b55fcc595e",
    "photo-1498050108023-c5249f4df085",
    "photo-1555949963-aa79dcee981c",
    "photo-1563013544-824ae1b704d3",
    "photo-1526374965328-7f61d4dc18c5",
    "photo-1535223289827-42f1e9919769",
    "photo-1593508512255-86ab42a8e620",
    "photo-1531297484001-80022131f5a1",
    "photo-1461749280684-dccba630e2f6",
    "photo-1517430816045-df4b7de11d1d",
  ].map(unsplash),
  "Krypto & Trading": [
    "photo-1621761191319-c6fb62004040",
    "photo-1639762681485-074b7f938ba0",
    "photo-1622630998477-20aa696ecb05",
    "photo-1640340434855-6084b1f4901c",
    "photo-1642104704074-907c0698cbd9",
    "photo-1620321023374-d1a68fbc720d",
    "photo-1640161704729-cbe966a08476",
  ].map(unsplash),
  "Finans & Marked": [
    "photo-1526304640581-d334cdbbf45e",
    "photo-1554224154-26032ffc0d07",
    "photo-1559526324-4b87b5e36e44",
    "photo-1591696205602-2f950c417cb9",
    "photo-1565514020179-026b92b84bb6",
    "photo-1520607162513-77705c0f0d4a",
    "photo-1563986768609-322da13575f3",
  ].map(unsplash),
  "Gründer & Startups": [
    "photo-1521737711867-e3b97375f902",
    "photo-1522071820081-009f0129c71c",
    "photo-1552664730-d307ca884978",
    "photo-1553877522-43269d4ea984",
    "photo-1556761175-b413da4baf72",
    "photo-1524758631624-e2822e304c36",
    "photo-1556761175-4b46a572b786",
  ].map(unsplash),
  "Penger & Karriere": [
    "photo-1554224154-26032ffc0d07",
    "photo-1554224155-1696413565d3",
    "photo-1579621970795-c87ae9d54501",
    "photo-1559526324-593b23c60e3a",
    "photo-1601597111158-2fceff292cdc",
    "photo-1522202176988-66273c2fd55f",
    "photo-1523240795612-9a054b0db644",
  ].map(unsplash),
  "Trender & Analyse": [
    "photo-1559526324-4b87b5e36e44",
    "photo-1563986768609-322da13575f3",
    "photo-1542744094-3a31f272c490",
    "photo-1551434678-e076c223a692",
    "photo-1454165804606-c3d57bc86b40",
    "photo-1532619675605-1ede6c2ed2b0",
    "photo-1591696205602-2f950c417cb9",
  ].map(unsplash),
  "Guider & Forklart": [
    "photo-1503676260728-1c00da094a0b",
    "photo-1523240795612-9a054b0db644",
    "photo-1522202176988-66273c2fd55f",
    "photo-1517048676732-d65bc937f952",
    "photo-1519389950473-47ba0277781c",
    "photo-1497633762265-9d179a990aa6",
    "photo-1455390582262-044cdead277a",
  ].map(unsplash),
};

const TOPIC_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "Krypto & Trading", pattern: /\b(bitcoin|ethereum|krypto|blockchain|defi|kryptovaluta)\b/i },
  { category: "Gründer & Startups", pattern: /\b(startup|startups|oppstart|gründer|venture|entreprenør)\b/i },
  { category: "Penger & Karriere", pattern: /\b(karriere|lønn|jobbmarked|sparing|personlig økonomi)\b/i },
  { category: "Finans & Marked", pattern: /\b(aksje|aksjer|børs|investering|obligasjon|rente|valuta|bank)\b/i },
  { category: "Guider & Forklart", pattern: /\b(guide|hvordan|forklart|veiledning)\b/i },
  { category: "Trender & Analyse", pattern: /\b(markedsanalyse|trendanalyse|dataanalyse)\b/i },
];

const BASE_POOL_SIZE = 20;

function imageKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    // Unsplash crop/resize parameters do not make a photograph unique.
    if (url.hostname === "images.unsplash.com") url.search = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function fallbackPool(category: string): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();
  const add = (candidate: string) => {
    const key = imageKey(candidate);
    if (key && !seen.has(key)) {
      seen.add(key);
      pool.push(candidate);
    }
  };

  // The shared collection currently has at most five unique images per category.
  // Stop when the modulo-based helper starts repeating instead of relying on its size.
  let firstKey = "";
  for (let index = 0; index < BASE_POOL_SIZE; index += 1) {
    const candidate = getCategoryFallbackImage(category, index);
    const key = imageKey(candidate);
    if (index === 0) firstKey = key;
    if (index > 0 && key === firstKey) break;
    add(candidate);
  }
  (SUPPLEMENTAL_IMAGES[category] || []).forEach(add);
  return pool;
}

function relevantCategory(article: ArticleImageInput): string {
  const text = [article.title, ...(article.tags || [])].join(" ");
  return TOPIC_RULES.find((rule) => rule.pattern.test(text))?.category || article.category;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectFallback(pool: string[], article: ArticleImageInput, used: Set<string>): string {
  const start = stableHash(`${article.id}:${article.title}`) % pool.length;
  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(start + offset) % pool.length];
    if (!used.has(imageKey(candidate))) return candidate;
  }
  // If a feed has more image-less stories than available photography, reuse the
  // stable choice rather than introducing an unrelated image from another topic.
  return pool[start];
}

export function resolveArticleImages(
  articles: ArticleImageInput[],
): Map<string, ResolvedArticleImage> {
  const used = new Set<string>();
  const resolved = new Map<string, ResolvedArticleImage>();

  for (const article of articles) {
    const original = article.image_url?.trim() || "";
    const originalKey = imageKey(original);
    const pool = fallbackPool(relevantCategory(article));
    const fallbackSrc = selectFallback(pool, article, used);
    const canUseOriginal = Boolean(originalKey) && !used.has(originalKey);
    const src = canUseOriginal ? original : fallbackSrc;

    used.add(imageKey(src));
    resolved.set(article.id, {
      src,
      fallbackSrc,
      usedFallback: !canUseOriginal,
    });
  }

  return resolved;
}
