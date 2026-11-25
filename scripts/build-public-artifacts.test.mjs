import { test, expect } from "bun:test";
import fs from "node:fs";

test("TanStack build no longer invokes legacy SPA artifact generation from Vite", () => {
  const vite = fs.readFileSync("vite.config.ts", "utf8");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(vite).toContain('@lovable.dev/vite-tanstack-config');
  expect(vite).not.toContain("buildPublicArtifacts");
  expect(pkg.scripts.build).toContain("--sitemaps-only");
  expect(pkg.scripts.build).not.toContain("build:artifacts");
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
  expect(pkg.scripts["build:sitemaps"]).toBe("node scripts/build-public-artifacts.mjs dist --sitemaps-only");
});
