export function generateSitemaps(
  outDir: string,
  base: string,
  key: string,
): Promise<{ files: string[]; articles: number; news: number }>;
