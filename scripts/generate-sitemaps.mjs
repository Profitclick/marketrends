// Builds all public sitemaps into the build output from published database rows.
import fs from "node:fs";
import path from "node:path";
import { dedupe, shard, urlset, newsFilter, newsset, sitemapIndex, VERTICALS } from "./sitemap-lib.mjs";

async function fetchAll(base, key, table, select, filter = "published=eq.true") {
  const rows = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${base}/rest/v1/${table}?select=${select}&${filter}&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + page - 1}` },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

export async function generateSitemaps(outDir, base, key) {
  const files = [];
  const write = (name, xml) => { fs.writeFileSync(path.join(outDir, name), xml); files.push(name); };
  const lm = (r) => (r.updated_at || r.created_at || "").slice(0, 10) || undefined;

  const cats = ["krypto-trading", "teknologi-ai", "finans-marked", "startup-innovasjon", "fintech-betaling", "regulering-politikk", "baerekraft-esg"];
  write("sitemap-pages.xml", urlset([{ path: "/" }, ...VERTICALS.map((v) => ({ path: `/${v}` })), ...cats.map((c) => ({ path: `/kategori/${c}` })), { path: "/om-oss" }, { path: "/ressurser" }]));

  const articles = dedupe(await fetchAll(base, key, "articles", "slug,title,created_at,updated_at"));
  shard(articles).forEach((s, i) => write(`sitemap-articles-${i + 1}.xml`, urlset(s.map((a) => ({ path: `/${a.slug}`, lastmod: lm(a) })))));

  const news = newsFilter(articles);
  if (news.length) write("sitemap-news.xml", newsset(news));

  const groups = [
    ["topics", "slug,created_at,updated_at", "/topic/", "article_count=gt.0"],
    ["entities", "slug,created_at,updated_at", "/entity/", "mention_count=gt.0"],
    ["knowledge_pages", "slug,created_at,updated_at", "/knowledge/"],
    ["guides", "slug,created_at,updated_at", "/guide/"],
    ["comparison_pages", "slug,created_at,updated_at", "/compare/"],
  ];
  for (const [table, sel, prefix, filter] of groups) {
    const rows = dedupe(await fetchAll(base, key, table, sel, filter));
    if (rows.length) write(`sitemap-${table.replace("_pages", "").replace("_", "-")}.xml`, urlset(rows.map((r) => ({ path: prefix + r.slug, lastmod: lm(r) }))));
  }

  fs.writeFileSync(path.join(outDir, "sitemap-index.xml"), sitemapIndex(files));
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemapIndex(files));
  return { files, articles: articles.length, news: news.length };
}
