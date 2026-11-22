export interface PublicArtifactBuildOptions {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  logger?: Pick<Console, "log" | "warn">;
}

export interface SitemapArtifactBuildOptions extends PublicArtifactBuildOptions {
  failOnError?: boolean;
}

export function buildSitemapArtifacts(
  outDir: string,
  options?: SitemapArtifactBuildOptions,
): Promise<unknown>;

export interface PublicArtifactBuildResult {
  sitemap: unknown;
  privateFiles: string[];
  prerender: {
    written: number;
    articles: number;
    sitemap: number;
    missing: number;
    unexpected: number;
    [key: string]: unknown;
  };
  notFound: string;
}

export function buildPublicArtifacts(
  outDir: string,
  options?: PublicArtifactBuildOptions,
): Promise<PublicArtifactBuildResult>;
