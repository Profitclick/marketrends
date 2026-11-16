import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderRoute, hubPage, listPage, parity, routeFile, routeHtmlError, HOME_TITLE, HOME_H1, SITE } from "./prerender-lib.mjs";

const tpl = `<html><head><title>G</title><link rel="canonical" href="https://marketrends.no/"></head><body><div id="root"></div></body></html>`;
const topics = [{ slug: "kryptovaluta", name: "Kryptovaluta" }, { slug: "inflasjon", name: "Inflasjon", meta_title: "Inflasjon – tema" }, { slug: "borsnotering", name: "Børsnotering" }];
const home = renderRoute(tpl, listPage({ path: "/", title: HOME_TITLE, h1: HOME_H1, description: "d", items: [] }));

function build(write) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "topic-"));
  fs.writeFileSync(path.join(dir, "sitemap-articles-1.xml"), `<url><loc>${SITE}/a</loc></url>`);
  fs.writeFileSync(path.join(dir, "sitemap-topics.xml"), topics.map((t) => `<url><loc>${SITE}/topic/${t.slug}</loc></url>`).join(""));
  const done = new Set();
  const put = (p, html) => { const f = routeFile(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); done.add(p); };
  put("/a", renderRoute(tpl, listPage({ path: "/a", title: "A", h1: "A", items: [] })));
  for (const t of topics) put(`/topic/${t.slug}`, write(t));
  return { dir, done };
}
const topicUrls = (dir) => [...fs.readFileSync(path.join(dir, "sitemap-topics.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test("every sitemap-topics URL has route-specific raw prerender HTML", () => {
  const { dir, done } = build((t) => renderRoute(tpl, hubPage({ prefix: "/topic/", row: t, label: "Tema" })));
  for (const u of topicUrls(dir)) {
    const html = fs.readFileSync(routeFile(dir, u.slice(SITE.length)), "utf8");
    expect(routeHtmlError(html, u)).toBeNull();
    expect(html).toContain(`<link rel="canonical" href="${u}"`);
    expect(html).not.toContain(`href="${SITE}/"`.replace(/"$/, '" data-prerender'));
  }
  const p = parity(fs, dir, done);
  expect(p.missing).toEqual([]);
  expect(p.invalid).toEqual([]);
});

test("a topic missing from raw output is reported", () => {
  const { dir, done } = build((t) => renderRoute(tpl, hubPage({ prefix: "/topic/", row: t, label: "Tema" })));
  fs.rmSync(routeFile(dir, "/topic/inflasjon"));
  expect(parity(fs, dir, done).missing).toEqual([`${SITE}/topic/inflasjon`]);
});

test("homepage HTML served at a topic path is rejected", () => {
  const { dir, done } = build(() => home);
  const p = parity(fs, dir, done);
  expect(p.invalid.length).toBe(3);
  expect(p.invalid[0]).toContain("canonical https://marketrends.no/");
});

test("homepage title or body with a correct canonical is still rejected", () => {
  const u = `${SITE}/topic/kryptovaluta`;
  const t = renderRoute(tpl, listPage({ path: "/topic/kryptovaluta", title: HOME_TITLE, h1: "Kryptovaluta", items: [] }));
  expect(routeHtmlError(t, u)).toBe("homepage title");
  const b = renderRoute(tpl, listPage({ path: "/topic/kryptovaluta", title: "Kryptovaluta", h1: HOME_H1, items: [] }));
  expect(routeHtmlError(b, u)).toBe("homepage body");
  expect(routeHtmlError(tpl, u)).not.toBeNull();
});
