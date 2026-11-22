import { test, expect } from "bun:test";
import fs from "node:fs";

test("Vite delegates public artifact policy to a portable orchestrator", () => {
  const vite = fs.readFileSync("vite.config.ts", "utf8");
  expect(vite).toContain('import { buildPublicArtifacts } from "./scripts/build-public-artifacts.mjs"');
  expect(vite).toContain("await buildPublicArtifacts(");
  expect(vite).not.toContain('import { generateSitemaps }');
  expect(vite).not.toContain('import { prerender }');
});

test("portable artifact orchestrator preserves deterministic build order", () => {
  const source = fs.readFileSync("scripts/build-public-artifacts.mjs", "utf8");
  const body = source.slice(source.indexOf("export async function buildPublicArtifacts"));
  const sitemap = body.indexOf("await generateSitemaps(");
  const privateRoutes = body.indexOf("generatePrivateRoutes(");
  const prerender = body.indexOf("await prerender(");
  const notFound = body.indexOf("generate404(");

  expect(sitemap).toBeGreaterThan(-1);
  expect(privateRoutes).toBeGreaterThan(sitemap);
  expect(prerender).toBeGreaterThan(privateRoutes);
  expect(notFound).toBeGreaterThan(prerender);
});

test("package exposes framework-independent artifact command", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  expect(pkg.scripts["build:artifacts"]).toBe("node scripts/build-public-artifacts.mjs dist");
});
