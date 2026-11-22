import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateSitemaps } from "./generate-sitemaps.mjs";
import { prerender } from "./prerender.mjs";
import { generate404 } from "./generate-404.mjs";
import { generatePrivateRoutes } from "./private-routes.mjs";

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
  const outDir = process.argv[2] || "dist";
  const options = {
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabasePublishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (process.argv.includes("--sitemaps-only")) {
    await buildSitemapArtifacts(outDir, { ...options, failOnError: true });
  } else {
    await buildPublicArtifacts(outDir, options);
  }
}
