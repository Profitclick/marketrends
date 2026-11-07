// Pure helpers for build-time public sitemaps (served from https://marketrends.no).
export const SITE_URL = "https://marketrends.no";
export const SHARD_SIZE = 45000;
export const NEWS_WINDOW_HOURS = 48;
export const VERTICALS = ["ai", "krypto", "fintech", "startup", "investering", "daytrading"];

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const dedupe = (rows, key = "slug") => {
  const seen = new Set();
  return rows.filter((r) => r[key] && !seen.has(r[key]) && seen.add(r[key]));
};

export const shard = (items, size = SHARD_SIZE) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const urlset = (entries) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries
    .map((e) => `  <url><loc>${esc(SITE_URL + e.path)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ""}</url>`)
    .join("\n") +
  `\n</urlset>\n`;

export const newsFilter = (articles, now = Date.now(), hours = NEWS_WINDOW_HOURS) =>
  dedupe(articles).filter((a) => now - new Date(a.created_at).getTime() <= hours * 3600_000);

export const newsset = (articles) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n` +
  articles
    .map(
      (a) =>
        `  <url><loc>${esc(`${SITE_URL}/${a.slug}`)}</loc><news:news><news:publication><news:name>Marketrends</news:name><news:language>no</news:language></news:publication><news:publication_date>${esc(new Date(a.created_at).toISOString())}</news:publication_date><news:title>${esc(a.title)}</news:title></news:news></url>`,
    )
    .join("\n") +
  `\n</urlset>\n`;

export const sitemapIndex = (files) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  files.map((f) => `  <sitemap><loc>${esc(`${SITE_URL}/${f}`)}</loc></sitemap>`).join("\n") +
  `\n</sitemapindex>\n`;
