import { test, expect } from "bun:test";
import { DAY_MS, computeTopicStats } from "../supabase/functions/_shared/topic-stats-core";

const NOW = Date.parse("2026-11-16T12:00:00.000Z");

test("computes published counts, freshness, hero and guide deterministically", () => {
  const stats = computeTopicStats(
    { name: "Kryptoregulering", meta_title: null, meta_description: null },
    [
      {
        relevance_score: 0.7,
        articles: {
          id: "news-new",
          created_at: new Date(NOW - DAY_MS).toISOString(),
          published: true,
          article_type: "news",
        },
      },
      {
        relevance_score: 0.95,
        articles: {
          id: "guide-new",
          created_at: new Date(NOW - 2 * DAY_MS).toISOString(),
          published: true,
          article_type: "guide",
        },
      },
      {
        relevance_score: 1,
        articles: {
          id: "draft",
          created_at: new Date(NOW).toISOString(),
          published: false,
          article_type: "guide",
        },
      },
    ],
    NOW,
  );

  expect(stats.article_count).toBe(2);
  expect(stats.articles_last_7d).toBe(2);
  expect(stats.articles_last_30d).toBe(2);
  expect(stats.hero_article_id).toBe("guide-new");
  expect(stats.explainer_article_id).toBe("guide-new");
  expect(stats.last_article_at).toBe(new Date(NOW - DAY_MS).toISOString());
  expect(stats.meta_description).toContain("2 artikler");
});

test("returns zeroed materialized stats when a topic has no published articles", () => {
  const stats = computeTopicStats(
    { name: "Tomt tema", meta_title: "Egen tittel", meta_description: "Egen tekst" },
    [
      {
        relevance_score: 1,
        articles: {
          id: "draft-only",
          created_at: new Date(NOW).toISOString(),
          published: false,
          article_type: "news",
        },
      },
    ],
    NOW,
  );

  expect(stats.article_count).toBe(0);
  expect(stats.last_article_at).toBeNull();
  expect(stats.articles_last_7d).toBe(0);
  expect(stats.articles_last_30d).toBe(0);
  expect(stats.hero_article_id).toBeNull();
  expect(stats.explainer_article_id).toBeNull();
  expect(stats.meta_title).toBe("Egen tittel");
  expect(stats.meta_description).toBe("Egen tekst");
});
