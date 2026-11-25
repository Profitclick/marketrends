import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { articleMetadata, clusterMetadata } from "../src/lib/routeMetadata";
import { getCluster } from "../src/config/clusters";
import type { RouteArticle } from "../src/lib/routeData";

const article: RouteArticle = {
  id: "article-stable-id",
  title: "Testartikkel",
  slug: "testartikkel",
  content: "Dette er en testartikkel med nok tekst til schema.",
  source_name: "Testkilde",
  source_url: "https://example.com/source",
  category: "Teknologi & AI",
  tags: ["AI", "Norge"],
  meta_description: "En kort beskrivelse.",
  image_url: "https://example.com/image.jpg",
  created_at: "2026-11-22T10:00:00Z",
  updated_at: "2026-11-22T11:00:00Z",
  published: true,
};

describe("article SSR preparation contracts", () => {

  test("article metadata is production-canonical and complete", () => {
    const meta = articleMetadata(article);

    expect(meta.canonicalUrl).toBe("https://marketrends.no/testartikkel");
    expect(meta.ogType).toBe("article");
    expect(meta.author).toBe("Marketrends.no");
    expect(meta.articleSchema).toMatchObject({ author: { "@type": "Organization", name: "Marketrends.no" }, isBasedOn: article.source_url });
    expect(meta.publishedTime).toBe(article.created_at);
    expect(meta.modifiedTime).toBe(article.updated_at);
    expect(meta.articleSchema).toBeTruthy();
  });
});

describe("cluster SSR preparation contracts", () => {
  test("vertical metadata stays production-canonical and contains schemas", () => {
    const cluster = getCluster("ai");
    expect(cluster).toBeTruthy();
    const meta = clusterMetadata(cluster!);

    expect(meta.canonicalUrl).toBe("https://marketrends.no/ai");
    expect(meta.articleSchema).toBeTruthy();
    expect(meta.faqSchema).toBeTruthy();
  });

  test("routeData owns the cluster query graph needed by vertical SSR", () => {
    const source = fs.readFileSync("src/lib/routeData.ts", "utf8");
    expect(source).toContain("loadClusterRouteData");
    expect(source).toContain('.from("cluster_definitions")');
    expect(source).toContain('.from("cluster_seed_nodes")');
    expect(source).toContain("article_clusters!inner(cluster_slug)");
    expect(source).toContain('.from("cluster_stats")');
  });
});
