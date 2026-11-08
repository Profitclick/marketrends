import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderRoute, listPage, parity, routeFile, CATEGORIES, isCanonicalSafe } from "./prerender-lib.mjs";

const tpl = `<html><head><title>G</title></head><body><div id="root"></div></body></html>`;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pr-"));
const put = (dir, p) => { const f = routeFile(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, "x"); };
const sm = (dir, name, paths) => fs.writeFileSync(path.join(dir, name), paths.map((p) => `<url><loc>https://marketrends.no${p}</loc></url>`).join(""));

test("category route gets a self canonical", () => {
  const html = renderRoute(tpl, listPage({ path: "/kategori/finans-marked", title: "Finans & Marked", h1: CATEGORIES["finans-marked"].name, crumbName: "Finans & Marked", description: "d", items: [] }));
  expect(html).toContain('<link rel="canonical" href="https://marketrends.no/kategori/finans-marked"');
  expect(html).not.toContain('href="https://marketrends.no/"' + " data-prerender>");
});

test("every sitemap URL, including an article older than the old 1000 cutoff, needs an output", () => {
  const dir = tmp();
  const old = Array.from({ length: 1200 }, (_, i) => `/sak-${i}`);
  sm(dir, "sitemap-pages.xml", ["/", "/kategori/finans-marked"]);
  sm(dir, "sitemap-articles-1.xml", old);
  const done = new Set(["/", "/kategori/finans-marked", ...old]);
  for (const p of done) put(dir, p);
  const r = parity(fs, dir, done);
  expect(r.missing).toEqual([]);
  expect(r.sitemap).toBe(1202);
  expect(fs.existsSync(routeFile(dir, "/sak-1150"))).toBe(true);
});

test("a missing expected prerender route is reported", () => {
  const dir = tmp();
  sm(dir, "sitemap-articles-1.xml", ["/a", "/b"]);
  put(dir, "/a");
  expect(parity(fs, dir, new Set(["/a"])).missing).toEqual(["https://marketrends.no/b"]);
});

test("parity fails closed without an article sitemap", () => {
  expect(() => parity(fs, tmp(), new Set())).toThrow();
});

test("canonical guard rejects non-canonical hosts", () => {
  for (const u of ["https://marketrends.lovable.app/x", "https://x.workers.dev/", "https://jsf.supabase.co/x", "https://marketrends.no/ed73ad9f-43df-4ba1"]) expect(isCanonicalSafe(u)).toBe(false);
  expect(isCanonicalSafe("https://marketrends.no/ai")).toBe(true);
  expect(isCanonicalSafe("https://marketrends.no/supabase-verdsettes-til-10-milliarder")).toBe(true);
});
