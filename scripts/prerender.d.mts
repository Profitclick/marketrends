export declare function prerender(outDir: string, base: string, key: string): Promise<{ written: number; articles: number; sitemap: number; missing: number; unexpected: number; failed: string[] }>;
