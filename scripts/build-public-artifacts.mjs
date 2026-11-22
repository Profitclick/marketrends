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
export async function buildPublicArtifacts(
  outDir,
  {
    supabaseUrl,
    supabasePublishableKey,
    logger = console,
  } = {},
) {
  const resolvedOutDir = path.resolve(outDir);
  let sitemapResult = null;

  try {
    sitemapResult = await generateSitemaps(
      resolvedOutDir,
      supabaseUrl,
      supabasePublishableKey,
    );
    logger.log(
      `[sitemaps] ${sitemapResult.files.length} files, ${sitemapResult.articles} articles, ${sitemapResult.news} news`,
    );
  } catch (error) {
    // Preserve current production build semantics: sitemap generation is
    // observed here, while prerender/parity remains the fail-closed gate.
    logger.warn("[sitemaps] generation failed:", error instanceof Error ? error.message : String(error));
  }

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
  await buildPublicArtifacts(outDir, {
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabasePublishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
}
