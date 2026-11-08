import { test, expect } from "bun:test";
import { renderRoute, articlePage } from "./prerender-lib.mjs";

const tpl = `<html><head><title>Generic</title><meta name="description" content="g"><meta property="og:url" content="https://marketrends.no/" /></head><body><div id="root"></div></body></html>`;
const a = { slug: "test-sak", title: "Test sak", content: "Første avsnitt med tilstrekkelig lengde til å telle som tekst.", category: "Finans & Marked", source_name: "NRK", created_at: "2026-11-08T10:00:00Z", article_topics: [{ topics: { slug: "inflasjon", name: "Inflasjon" } }] };

test("article route gets self canonical, h1, NewsArticle and breadcrumbs; generic tags removed", () => {
  const html = renderRoute(tpl, articlePage(a));
  expect(html).toContain('<link rel="canonical" href="https://marketrends.no/test-sak"');
  expect(html).toContain('<meta property="og:url" content="https://marketrends.no/test-sak"');
  expect(html).not.toContain("<title>Generic</title>");
  expect(html).not.toContain('content="https://marketrends.no/" />');
  expect(html.match(/<h1>/g)).toHaveLength(1);
  expect(html).toContain('"@type":"NewsArticle"');
  expect(html).toContain('"@type":"BreadcrumbList"');
  expect(html).toContain('<a href="/topic/inflasjon">');
  expect(html).not.toContain("FAQPage");
});

test("dashboard, admin and auth are never prerendered", () => {
  for (const p of ["/dashboard", "/admin", "/auth"]) expect(() => renderRoute(tpl, { path: p, title: "x", h1: "x" })).toThrow();
});
