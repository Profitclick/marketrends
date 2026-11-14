import { describe, expect, test } from "bun:test";
import { resolveArticleImages, type ArticleImageInput } from "../src/utils/articleImages";

const article = (overrides: Partial<ArticleImageInput> = {}): ArticleImageInput => ({
  id: "article-1",
  title: "Ny AI-analyse fra norsk teknologisektor",
  category: "Teknologi & AI",
  image_url: null,
  tags: [],
  ...overrides,
});

describe("category article images", () => {
  test("a unique original image is always preserved", () => {
    const original = "https://media.example.com/robot.jpg?width=900";
    const result = resolveArticleImages([article({ image_url: original })]).get("article-1");

    expect(result?.src).toBe(original);
    expect(result?.usedFallback).toBe(false);
  });

  test("only the first card uses a duplicated original image", () => {
    const original = "https://media.example.com/shared.jpg";
    const result = resolveArticleImages([
      article({ id: "first", image_url: original }),
      article({ id: "second", title: "En annen sak", image_url: original }),
    ]);

    expect(result.get("first")?.src).toBe(original);
    expect(result.get("second")?.src).not.toBe(original);
    expect(result.get("second")?.usedFallback).toBe(true);
  });

  test("the same Unsplash photograph with another crop is still a duplicate", () => {
    const result = resolveArticleImages([
      article({ id: "first", image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop" }),
      article({ id: "second", image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop" }),
    ]);

    expect(result.get("second")?.usedFallback).toBe(true);
    expect(result.get("second")?.src).not.toContain("photo-1518770660439-4636190af475");
  });

  test("missing images use deterministic, topic-relevant fallbacks", () => {
    const bitcoin = article({ id: "bitcoin", title: "Bitcoin-utvinning i norsk kraftmarked", tags: ["krypto"] });
    const first = resolveArticleImages([bitcoin]).get("bitcoin")?.src;
    const second = resolveArticleImages([{ ...bitcoin }]).get("bitcoin")?.src;

    expect(first).toBe(second);
    expect(first).toBeTruthy();
    expect(resolveArticleImages([article({ ...bitcoin, title: "Helsevesenet får ny AI-løsning", tags: [] })]).get("bitcoin")?.src).not.toBe(first);
  });

  test.each([
    "Teknologi & AI",
    "Krypto & Trading",
    "Finans & Marked",
    "Gründer & Startups",
    "Penger & Karriere",
    "Trender & Analyse",
    "Guider & Forklart",
  ])("all 24 cards have unique fallbacks in %s", (category) => {
    const articles = Array.from({ length: 24 }, (_, index) => article({
      id: `${category}-${index}`,
      title: `Redaksjonell sak nummer ${index}`,
      category,
    }));
    const result = resolveArticleImages(articles);
    const sources = articles.map((item) => result.get(item.id)?.src);

    expect(new Set(sources).size).toBe(24);
  });

  test("fallback selection avoids photographs already used by original articles", () => {
    const fallback = resolveArticleImages([article()]).get("article-1")?.src as string;
    const original = article({ id: "original", title: "Originalfoto", image_url: fallback });
    const missing = article({ id: "missing", title: "Mangler foto" });
    const result = resolveArticleImages([original, missing]);

    expect(result.get("original")?.src).toBe(fallback);
    expect(result.get("missing")?.src).not.toBe(fallback);
  });

  test("broken original images have distinct error fallbacks", () => {
    const articles = Array.from({ length: 6 }, (_, index) => article({
      id: `original-${index}`,
      title: `Originalsak ${index}`,
      image_url: `https://media.example.com/original-${index}.jpg`,
    }));
    const result = resolveArticleImages(articles);
    const fallbacks = articles.map((item) => result.get(item.id)?.fallbackSrc);

    expect(new Set(fallbacks).size).toBe(articles.length);
  });

  test("resolution does not mutate the article list", () => {
    const articles = [article(), article({ id: "article-2", title: "Ny sak" })];
    const snapshot = structuredClone(articles);

    resolveArticleImages(articles);
    expect(articles).toEqual(snapshot);
  });
});
