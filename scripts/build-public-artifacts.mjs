import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateSitemaps } from "./generate-sitemaps.mjs";
import { prerender } from "./prerender.mjs";
import { generate404 } from "./generate-404.mjs";
import { generatePrivateRoutes } from "./private-routes.mjs";

function resolveBuildDirectory(parent, from, value, field) {
  if (typeof value !== "string" || !value.trim() || path.isAbsolute(value)) {
    throw new Error(`Invalid Nitro ${field}: expected a relative directory`);
  }

  function assertInside(candidate) {
    const relative = path.relative(parent, candidate);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Invalid Nitro ${field}: directory must be inside ${parent}`);
    }
  }

  const directory = path.resolve(from, value);
  assertInside(directory);
  const resolved = realpathSync(directory);
  assertInside(resolved);
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Invalid Nitro ${field}: ${resolved} is not a directory`);
  }
  return resolved;
}

export function resolveNitroPublicDir(root = process.cwd()) {
  const projectDir = realpathSync(root);
  const lastBuildPath = path.join(projectDir, "node_modules", ".nitro", "last-build.json");
  try {
    const lastBuild = JSON.parse(readFileSync(lastBuildPath, "utf8"));
    // Nitro records outputDir relative to the pointer file path itself.
    const outputDir = resolveBuildDirectory(projectDir, lastBuildPath, lastBuild?.outputDir, "outputDir");
    const manifest = JSON.parse(readFileSync(path.join(outputDir, "nitro.json"), "utf8"));
    return resolveBuildDirectory(outputDir, outputDir, manifest?.publicDir, "publicDir");
  } catch (error) {
    throw new Error(`Cannot resolve Nitro public output from ${lastBuildPath}: ${error.message}`, { cause: error });
  }
}

/**
 * Framework-independent public artifact build.
 *
 * Vite calls this after its client bundle today. A future server framework can
 * invoke the same deterministic sitemap/private/prerender/404 sequence without
 * coupling the policy to a Vite lifecycle hook.
 */
export async function buildSitemapArtifacts(
  outDir,
  {
    supabaseUrl,
    supabasePublishableKey,
    logger = console,
    failOnError = true,
  } = {},
) {
  const resolvedOutDir = path.resolve(outDir);

  try {
    const sitemapResult = await generateSitemaps(
      resolvedOutDir,
      supabaseUrl,
      supabasePublishableKey,
    );
    logger.log(
      `[sitemaps] ${sitemapResult.files.length} files, ${sitemapResult.articles} articles, ${sitemapResult.news} news`,
    );
    return sitemapResult;
  } catch (error) {
    if (failOnError) throw error;
    logger.warn("[sitemaps] generation failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Current SPA artifact build.
 *
 * The legacy private shells, physical prerender files and static 404 remain in
 * place until the TanStack Start migration replaces those responsibilities
 * with server routes. The sitemap step is independently reusable through
 * buildSitemapArtifacts().
 */
export async function buildPublicArtifacts(
  outDir,
  {
    supabaseUrl,
    supabasePublishableKey,
    logger = console,
  } = {},
) {
  const resolvedOutDir = path.resolve(outDir);
  const sitemapResult = await buildSitemapArtifacts(resolvedOutDir, {
    supabaseUrl,
    supabasePublishableKey,
    logger,
    // Preserve current SPA behavior: prerender/parity remains the fail-closed
    // gate when sitemap generation itself fails.
    failOnError: false,
  });

  const privateFiles = generatePrivateRoutes(resolvedOutDir);
  logger.log(`[private-routes] ${privateFiles.length} noindex shells`);

  const prerenderResult = await prerender(
    resolvedOutDir,
    supabaseUrl,
    supabasePublishableKey,
  );
  logger.log(
    `[prerender] ${prerenderResult.written} routes, ${prerenderResult.articles} articles; sitemap ${prerenderResult.sitemap}, missing ${prerenderResult.missing}, unexpected ${prerenderResult.unexpected}`,
  );

  const notFound = generate404(resolvedOutDir);
  logger.log(`[404] generated ${notFound}`);

  return {
    sitemap: sitemapResult,
    privateFiles,
    prerender: prerenderResult,
    notFound,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const output = process.argv[2] || "dist";
  const options = {
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabasePublishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (process.argv.includes("--sitemaps-only")) {
    const outDir = output === "--nitro-public-dir" ? resolveNitroPublicDir() : output;
    await buildSitemapArtifacts(outDir, { ...options, failOnError: true });
  } else {
    await buildPublicArtifacts(output, options);
  }
}
