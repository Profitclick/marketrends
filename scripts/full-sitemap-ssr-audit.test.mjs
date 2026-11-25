import { describe, test, expect } from "bun:test";
import { decode, locs, evaluate } from "./full-sitemap-ssr-audit.mjs";

describe("full isolated sitemap audit", () => {
  test("parses every location and rejects malformed entries", () => {
    expect(locs("<urlset><url><loc>https://marketrends.no/a</loc></url><url><loc>https://marketrends.no/b</loc></url></urlset>", "urlset", "url")).toHaveLength(2);
    expect(() => locs("<urlset><url><lastmod>2026-01-01</lastmod></url></urlset>", "urlset", "url")).toThrow();
    expect(decode("A &amp; B &#248;")).toBe("A & B ø");
  });
  test("rejects duplicate canonicals and noindex even with status 200", () => {
    const url = "https://marketrends.no/test";
    const link = '<link rel="canonical" href="' + url + '">';
    const html = '<html><head><title>Test</title>' + link + link + '<meta property="og:url" content="' + url + '"><meta name="description" content="Test"><meta name="robots" content="noindex"><meta name="googlebot" content="index, follow"></head><body><main><h1>Test</h1></main></body></html>';
    const result = evaluate({url, kind:"page"}, 200, new Headers({"content-type":"text/html"}), html);
    expect(result.issues).toContain("CANONICAL_MISMATCH");
    expect(result.issues).toContain("ROBOTS_MISMATCH");
  });
  test("serialized fake body markup does not pass visible heading validation", () => {
    const result = evaluate({url:"https://marketrends.no/test",kind:"page"}, 200, new Headers({"content-type":"text/html"}), '<html><head><title>Test</title></head><body><script>const x="<main><h1>Test</h1></main>"</script></body></html>');
    expect(result.issues).toContain("MISSING_OR_ERROR_H1");
    expect(result.issues).toContain("MISSING_MAIN");
  });
});
