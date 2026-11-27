import { test, expect } from "bun:test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveNitroPublicDir } from "./build-public-artifacts.mjs";

test("TanStack build no longer invokes legacy SPA artifact generation from Vite", () => {
  const vite = fs.readFileSync("vite.config.ts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(vite).toContain('@lovable.dev/vite-tanstack-config');
  expect(vite).not.toContain("buildPublicArtifacts");
  expect(pkg.scripts.build).toBe("vite build && npm run build:sitemaps");
});

test("portable artifact orchestrator separates strict sitemap generation from legacy SPA artifacts", () => {
  const source = fs.readFileSync("scripts/build-public-artifacts.mjs", "utf8");
  const sitemapBody = source.slice(
    source.indexOf("export async function buildSitemapArtifacts"),
    source.indexOf("export async function buildPublicArtifacts"),
  );
  const legacyBody = source.slice(source.indexOf("export async function buildPublicArtifacts"));

  expect(sitemapBody).toContain("await generateSitemaps(");
  expect(sitemapBody).not.toContain("generatePrivateRoutes(");
  expect(sitemapBody).not.toContain("await prerender(");
  expect(sitemapBody).not.toContain("generate404(");

  const sitemap = legacyBody.indexOf("await buildSitemapArtifacts(");
  const privateRoutes = legacyBody.indexOf("generatePrivateRoutes(");
  const prerender = legacyBody.indexOf("await prerender(");
  const notFound = legacyBody.indexOf("generate404(");

  expect(sitemap).toBeGreaterThan(-1);
  expect(privateRoutes).toBeGreaterThan(sitemap);
  expect(prerender).toBeGreaterThan(privateRoutes);
  expect(notFound).toBeGreaterThan(prerender);
});

test("package exposes legacy and strict sitemap-only artifact commands", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  expect(pkg.scripts["build:artifacts"]).toBe("node scripts/build-public-artifacts.mjs dist");
  expect(pkg.scripts["build:sitemaps"]).toContain("scripts/build-public-artifacts.mjs --nitro-public-dir --sitemaps-only");
});

function withNitroFixture(run) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "marketrends-nitro-"));
  const pointer = path.join(root, "node_modules/.nitro/last-build.json");
  fs.mkdirSync(path.dirname(pointer), { recursive: true });
  function pointTo(output) {
    fs.writeFileSync(pointer, JSON.stringify({ outputDir: path.relative(pointer, path.join(root, output)) }));
  }
  for (const [output, publicDir] of [[".output", "public"], ["dist", "client"]]) {
    fs.mkdirSync(path.join(root, output, publicDir), { recursive: true });
    fs.writeFileSync(path.join(root, output, "nitro.json"), JSON.stringify({ publicDir }));
  }
  try {
    run(root, pointer, pointTo);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test.each([[".output", "public"], ["dist", "client"]])(
  "sitemap command writes only to Nitro's active %s/%s and preserves the external news entry",
  (output, publicDir) => withNitroFixture((root, _pointer, pointTo) => {
    pointTo(output);
    const mockFetch = path.join(root, "mock-fetch.mjs");
    fs.writeFileSync(mockFetch, `
      process.env.VITE_SUPABASE_URL = 'https://fixture.invalid';
      globalThis.fetch = async () => Response.json([]);
    `);
    const run = spawnSync("node", ["--import", mockFetch, path.resolve("scripts/build-public-artifacts.mjs"),
      "--nitro-public-dir", "--sitemaps-only"], { cwd: root, encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);

    const active = path.join(root, output, publicDir);
    const inactive = output === "dist" ? ".output/public" : "dist/client";
    expect(fs.readdirSync(path.join(root, inactive))).toEqual([]);
    expect(fs.readdirSync(active).sort()).toEqual([
      "sitemap-index.xml", "sitemap-news.xml", "sitemap-pages.xml", "sitemap.xml",
    ]);
    const index = fs.readFileSync(path.join(active, "sitemap-index.xml"), "utf8");
    expect(index).toContain("<loc>https://marketrends.no/sitemap-pages.xml</loc>");
    expect(index.match(/<loc>[^<]*\/sitemap-news\.xml<\/loc>/g)).toEqual([
      "<loc>https://news-sitemap.marketrends.no/sitemap-news.xml</loc>",
    ]);
    expect(fs.readFileSync(path.join(active, "sitemap.xml"), "utf8")).toBe(index);
  }),
);

test("Nitro resolution fails closed with missing or corrupt build metadata", () => {
  withNitroFixture((root, pointer, pointTo) => {
    expect(() => resolveNitroPublicDir(root)).toThrow("Cannot resolve Nitro public output");
    fs.writeFileSync(pointer, "invalid JSON");
    expect(() => resolveNitroPublicDir(root)).toThrow("Cannot resolve Nitro public output");
    pointTo("missing");
    expect(() => resolveNitroPublicDir(root)).toThrow("ENOENT");
    pointTo("dist");
    fs.rmSync(path.join(root, "dist/nitro.json"));
    expect(() => resolveNitroPublicDir(root)).toThrow("nitro.json");
  });
});

test("Nitro resolution rejects invalid public directories without falling back", () => {
  withNitroFixture((root, _pointer, pointTo) => {
    pointTo("dist");
    fs.writeFileSync(path.join(root, "dist/file"), "");
    fs.symlinkSync(path.join(root, ".output/public"), path.join(root, "dist/link"));
    for (const [publicDir, error] of [
      ["", "relative directory"], ["missing", "ENOENT"], ["file", "not a directory"],
      [".", "inside"], ["../.output/public", "inside"], ["link", "inside"],
      [path.join(root, "dist/client"), "relative directory"],
    ]) {
      fs.writeFileSync(path.join(root, "dist/nitro.json"), JSON.stringify({ publicDir }));
      expect(() => resolveNitroPublicDir(root)).toThrow(error);
    }
  });
});
