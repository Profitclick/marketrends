import { test, expect } from "bun:test";
import fs from "node:fs";

test("Vite delegates public artifact policy to a portable orchestrator", () => {
  const vite = fs.readFileSync("vite.config.ts", "utf8");
  expect(vite).toContain('import { buildPublicArtifacts } from "./scripts/build-public-artifacts.mjs"');
  expect(vite).toContain("await buildPublicArtifacts(");
  expect(vite).not.toContain('import { generateSitemaps }');
  expect(vite).not.toContain('import { prerender }');
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
