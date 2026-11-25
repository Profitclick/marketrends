// Read-only production smoke check. No credentials, mutations, AI or GSC decisions.
import fs from 'node:fs';

const ORIGIN = 'https://marketrends.no'; // canonical truth, always production
const AUDIT = (process.env.MARKETRENDS_AUDIT_ORIGIN || ORIGIN).replace(/\/+$/, '');
const NEWS = 'https://news-sitemap.marketrends.no/sitemap-news.xml';
const S = '__seo_nonexistent_20261122';
const missing = ['kategori', 'topic', 'entity', 'guide', 'knowledge', 'compare', 'intent', 'cluster']
  .map((p) => ({ id: `unknown_${p}`, url: `${AUDIT}/${p}/${S}`, kind: 'not_found' }));
const routes = [
  { id: 'homepage', url: `${AUDIT}/`, kind: 'homepage' },
  { id: 'admin', url: `${AUDIT}/admin`, kind: 'private' },
  { id: 'auth', url: `${AUDIT}/auth`, kind: 'private' },
  { id: 'dashboard', url: `${AUDIT}/dashboard`, kind: 'private' },
  { id: 'unknown', url: `${AUDIT}/${S}`, kind: 'not_found' },
  ...missing,
  { id: 'legacy_cluster', url: `${AUDIT}/cluster/ai`, kind: 'redirect', target: `${AUDIT}/ai` },
  { id: 'unknown_ressurser', url: `${AUDIT}/ressurser/${S}`, kind: 'not_found', advisory: true },
  { id: 'sitemap_index', url: `${AUDIT}/sitemap-index.xml`, kind: 'sitemap_index' },
  {
    id: 'worker_news',
    url: NEWS,
    kind: 'news_worker',
    // The dedicated Worker is outside a non-production frontend preview.
    // Keep it blocking only when auditing the canonical production origin.
    advisory: AUDIT !== ORIGIN,
  },
  { id: 'legacy_news', url: `${AUDIT}/sitemap-news.xml`, kind: 'news_legacy', advisory: true },
];
const BAD_CANON = /lovable\.app|lovableproject\.com|workers\.dev|supabase\.co/i;

function getAttr(tag, attr) {
  const match = tag.match(new RegExp(`(?:^|\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}
function meta(html, name) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (getAttr(match[0], 'name')?.toLowerCase() === name) return getAttr(match[0], 'content');
  }
  return null;
}
function canonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    if (getAttr(match[0], 'rel')?.toLowerCase().split(/\s+/).includes('canonical')) return getAttr(match[0], 'href');
  }
  return null;
}
function containsDirective(directives, token) {
  return (directives ?? '').split(/[\s,;]+/).some((s) => s.toLowerCase() === token);
}
function evaluate(route, status, location, contentType, body) {
  const issues = [];
  const robots = meta(body, 'robots');
  const googlebot = meta(body, 'googlebot');
  const actualCanonical = canonical(body);
  const xml = /(?:application|text)\/xml|\+xml/i.test(contentType ?? '');
  const expect = (condition, message) => { if (!condition) issues.push(message); };
  if (actualCanonical) expect(!BAD_CANON.test(actualCanonical) && actualCanonical.startsWith(`${ORIGIN}/`), 'Canonical must use https://marketrends.no');
  switch (route.kind) {
    case 'homepage':
      expect(status === 200, 'Homepage must serve HTTP 200');
      expect(actualCanonical === `${ORIGIN}/`, 'Homepage must have self-canonical');
      break;
    case 'private':
      expect(status === 200, 'Private route must serve its own HTML shell');
      expect(containsDirective(robots, 'noindex') && containsDirective(robots, 'nofollow'), 'Private initial HTML must have robots noindex,nofollow');
      expect(containsDirective(googlebot, 'noindex') && containsDirective(googlebot, 'nofollow'), 'Private initial HTML must have googlebot noindex,nofollow');
      expect(!actualCanonical, 'Private initial HTML must not have a public canonical');
      break;
    case 'not_found':
      expect(status === 404, 'Unknown route must return real HTTP 404, not SPA 200');
      break;
    case 'redirect': {
      expect(status === 301 || status === 308, 'Legacy cluster must redirect with HTTP 301 or 308');
      const resolved = location ? new URL(location, route.url).href : null;
      expect(resolved === route.target, 'Legacy cluster must set Location to canonical short route');
      break;
    }
    case 'sitemap_index':
      expect(status === 200 && xml, 'Sitemap index must serve XML with HTTP 200');
      expect(/<sitemapindex\b/i.test(body), 'Sitemap index must be sitemapindex XML');
      expect(body.includes(`<loc>${NEWS}</loc>`), 'Sitemap index must reference Worker news sitemap');
      expect(!body.includes(`<loc>${ORIGIN}/sitemap-news.xml</loc>`), 'Sitemap index must not use static fallback');
      break;
    case 'news_worker':
      expect(status === 200 && xml, 'Worker news sitemap must serve XML with HTTP 200');
      expect(/<(?:urlset|sitemapindex)\b/i.test(body), 'Worker news sitemap must have XML sitemap root');
      break;
    case 'news_legacy':
      // Observation-only: a legacy submission can remain in GSC even if not in the current index.
      break;
  }
  return { issues, robots, googlebot, canonical: actualCanonical };
}

async function probe(route) {
  const advisory = Boolean(route.advisory);
  try {
    const response = await fetch(route.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'MarketrendsReadOnlySEOSmokeTest/1.0', accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8' },
    });
    const body = await response.text();
    const location = response.headers.get('location');
    const contentType = response.headers.get('content-type');
    const check = evaluate(route, response.status, location, contentType, body);
    return { id: route.id, url: route.url, status: response.status, location, contentType, ...check, passed: check.issues.length === 0, advisory, workerSource: route.kind === 'news_worker' ? response.headers.get('x-marketrends-sitemap-source') : null, workerNewsCount: route.kind === 'news_worker' ? response.headers.get('x-marketrends-news-count') : null };
  } catch (error) {
    return { id: route.id, url: route.url, passed: false, advisory, issues: [`Fetch failed: ${error.message}`] };
  }
}
const results = await Promise.all(routes.map(probe));

const timestamp = new Date().toISOString();
const failures = results.filter((result) => !result.passed && !result.advisory);
const data = { timestamp, origin: ORIGIN, auditOrigin: AUDIT, mode: 'read-only', failures: failures.length, checks: results };
fs.mkdirSync('seo-audit', { recursive: true });
fs.writeFileSync('seo-audit/http-audit.json', `${JSON.stringify(data, null, 2)}\n`);
const lines = [
  '# Marketrends read-only production HTTP audit',
  `Checked ${timestamp}. This observes the initial HTTP response, not SPA navigation. No writes or content changes.`,
  '', '| Check | HTTP | Result | Evidence |', '|---|---:|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.status ?? 'n/a'} | ${r.passed ? 'PASS' : 'FAIL'}${r.advisory ? ' (advisory)' : ''} | ${(r.issues ?? []).join('; ') || 'Expected response'} |`),
  '', `**Blocking HTTP failures: ${failures.length}.**`,
];
const summary = `${lines.join('\n')}\n`;
fs.writeFileSync('seo-audit/http-audit.md', summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (failures.length) process.exitCode = 1;
