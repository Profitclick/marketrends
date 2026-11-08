export declare const ARTICLE_LIMIT: number;
export declare function prerender(outDir: string, base: string, key: string): Promise<{ written: number; failed: string[]; articles: number }>;
