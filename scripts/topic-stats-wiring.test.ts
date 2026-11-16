import { test, expect } from "bun:test";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("article topic rewrites refresh affected topic stats", () => {
  const source = read("supabase/functions/enrich-article/index.ts");
  expect(source).toContain('from("article_topics").delete()');
  expect(source).toContain("refreshTopicStats(supabase, [...affectedTopicIds])");
});

test("admin publish and delete paths invoke bounded topic refresh", () => {
  const list = read("src/components/ArticleList.tsx");
  const moderation = read("src/components/ArticleModeration.tsx");

  expect(list).toContain("refreshTopicStatsForArticleIds([id])");
  expect(list).toContain("getTopicIdsForArticles([id])");
  expect(list).toContain("refreshTopicStatsForTopicIds(topicIds)");

  expect(moderation).toContain("refreshTopicStatsForArticleIds(articleIds)");
  expect(moderation).toContain("getTopicIdsForArticles(articleIds)");
  expect(moderation).toContain("refreshTopicStatsForTopicIds(topicIds)");
});

test("rebuild-topic-stats supports bounded article and topic ids", () => {
  const source = read("supabase/functions/rebuild-topic-stats/index.ts");
  expect(source).toContain('normalizeBoundedIds(body.topic_ids, "topic_ids")');
  expect(source).toContain('normalizeBoundedIds(body.article_ids, "article_ids")');
  expect(source).toContain('mode: "bounded"');
});
