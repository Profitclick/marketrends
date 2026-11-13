// Read-only production smoke check. No credentials, mutations, AI or GSC decisions.
import fs from 'node:fs';

const ORIGIN = 'https://marketrends.no';
const NEWS = 'https://news-sitemap.marketrends.no/sitemap-news.xml';
const routes = [
  { id: 'homepage', url: `${ORIGIN}/`, kind: 'homepage' },
  { id: 'admin', url: `${ORIGIN}/admin`, kind: 'private' },
  { id: 'auth', url: `${ORIGIN}/auth`, kind: 'private' },
  { id: 'dashboard', url: `${ORIGIN}/dashboard`, kind: 'private' },
  { id: 'unknown', url: `${ORIGIN}/__seo_nonexistent_route_20261113`, kind: 'not_found' },
  { id: 'unknown_cluster', url: `${ORIGIN}/cluster/__seo_nonexistent_20261113`, kind: 'not_found' },
  { id: 'legacy_cluster', url: `${ORIGIN}/cluster/ai`, kind: 'redirect', target: `${ORIGIN}/ai` },
  { id: 'sitemap_index', url: `${ORIGIN}/sitemap-index.xml`, kind: 'sitemap_index' },
  { id: 'worker_news', url: NEWS, kind: 'news_worker' },
  { id: 'legacy_news', url: `${ORIGIN}/sitemap-news.xml`, kind: 'news_legacy' },
];

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

const results = [];
for (const route of routes) {
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
    results.push({ id: route.id, url: route.url, status: response.status, location, contentType, ...check, passed: check.issues.length === 0, advisory: route.kind === 'news_legacy', workerSource: route.kind === 'news_worker' ? response.headers.get('x-marketrends-sitemap-source') : null, workerNewsCount: route.kind === 'news_worker' ? response.headers.get('x-marketrends-news-count') : null });
  } catch (error) {
    results.push({ id: route.id, url: route.url, passed: false, advisory: false, issues: [`Fetch failed: ${error.message}`] });
  }
}

const timestamp = new Date().toISOString();
const failures = results.filter((result) => !result.passed && !result.advisory);
const data = { timestamp, origin: ORIGIN, mode: 'read-only', failures: failures.length, checks: results };
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
