import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRIVATE_ROUTES, generatePrivateRoutes, renderPrivateRoute } from "./private-routes.mjs";

const template = `<!doctype html><html><head>
<title>Homepage</title>
<meta name="description" content="Homepage description">
<meta name="googlebot" content="index, follow">
<meta name="googlebot-news" content="index, follow">
<meta property="og:url" content="https://marketrends.no/">
<link rel="canonical" href="https://marketrends.no/">
<link rel="alternate" hreflang="nb" href="https://marketrends.no/">
</head><body><div id="root"><main data-prerender-body><h1>Homepage content</h1></main></div><script type="module" src="/assets/index.js"></script></body></html>`;

test("private initial HTML is noindex,nofollow without homepage content or canonical", () => {
  for (const [route, label] of PRIVATE_ROUTES) {
    const html = renderPrivateRoute(template, route, label);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<meta name="googlebot" content="noindex, nofollow">');
    expect(html).not.toContain("index, follow");
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('rel="alternate"');
    expect(html).not.toContain("Homepage content");
    expect(html).not.toContain("data-prerender-body");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
    expect(html.match(/<title>/g)).toHaveLength(1);
  }
});

test("private shell generation writes exactly the three private entry documents", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "private-routes-"));
  fs.writeFileSync(path.join(outDir, "index.html"), template);
  const files = generatePrivateRoutes(outDir);
  expect(files.map((file) => path.relative(outDir, file)).sort()).toEqual([
    "admin/index.html",
    "auth/index.html",
    "dashboard/index.html",
  ]);
  expect(fs.readFileSync(path.join(outDir, "index.html"), "utf8")).toBe(template);
});

test("private shells fail closed for an unknown route or missing root", () => {
  expect(() => renderPrivateRoute(template, "/admin/unknown", "Unknown")).toThrow("unknown private route");
  expect(() => renderPrivateRoute("<html></html>", "/admin", "Admin")).toThrow("template root not found");
});
