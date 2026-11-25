const PROD = "https://marketrends.no";
const AUDIT = (process.env.MARKETRENDS_AUDIT_ORIGIN || PROD).replace(/\/+$/, "");
const REQUIRED_SITEMAP_PREFIXES = [
  "sitemap-pages",
  "sitemap-articles-",
  "sitemap-topics",
  "sitemap-entities",
  "sitemap-guides",
  "sitemap-comparison",
];

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) =>
    match[1].replace(/&amp;/g, "&"),
  );
}

function canonical(html) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\brel=(?:"canonical"|'canonical'|canonical)(?:\s|>|\/)/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (href) return href[1] ?? href[2] ?? href[3] ?? null;
  }
  return null;
}

function auditUrl(productionUrl) {
  const url = new URL(productionUrl);
  return AUDIT + url.pathname + url.search;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: { "user-agent": "MarketrendsSSRParity/1.0" },
  });
  return { response, body: await response.text() };
}

const failures = [];
const checks = [];

const indexResult = await fetchText(`${AUDIT}/sitemap-index.xml`);
if (indexResult.response.status !== 200) {
  failures.push(`sitemap-index: expected 200, got ${indexResult.response.status}`);
} else {
  const sitemapUrls = locs(indexResult.body).filter((url) => url.startsWith(PROD));
  for (const prefix of REQUIRED_SITEMAP_PREFIXES) {
    const sitemapUrl = sitemapUrls.find((url) => new URL(url).pathname.split("/").pop()?.startsWith(prefix));
    if (!sitemapUrl) {
      failures.push(`${prefix}: missing from sitemap index`);
      continue;
    }

    const sitemapResult = await fetchText(auditUrl(sitemapUrl));
    if (sitemapResult.response.status !== 200) {
      failures.push(`${prefix}: sitemap expected 200, got ${sitemapResult.response.status}`);
      continue;
    }

    const productionPage = locs(sitemapResult.body).find((url) => url.startsWith(PROD));
    if (!productionPage) {
      failures.push(`${prefix}: no production URL in sitemap`);
      continue;
    }

    const pageResult = await fetchText(auditUrl(productionPage));
    const pageCanonical = canonical(pageResult.body);
    const hasH1 = /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(pageResult.body);
    const passed =
      pageResult.response.status === 200 &&
      pageCanonical === productionPage &&
      hasH1;

    checks.push({
      sitemap: new URL(sitemapUrl).pathname,
      productionPage,
      auditPage: auditUrl(productionPage),
      status: pageResult.response.status,
      canonical: pageCanonical,
      hasH1,
      passed,
    });

    if (!passed) {
      failures.push(
        `${prefix}: status=${pageResult.response.status}, canonical=${pageCanonical}, expected=${productionPage}, h1=${hasH1}`,
      );
    }
  }
}

console.log(JSON.stringify({ auditOrigin: AUDIT, checks, failures }, null, 2));
if (failures.length) process.exitCode = 1;
