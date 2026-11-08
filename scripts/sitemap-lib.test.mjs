import { test, expect } from "bun:test";
import { shard, newsFilter, dedupe, SHARD_SIZE, NEWS_SHARD_SIZE } from "./sitemap-lib.mjs";
import { clusterRedirectTarget } from "../src/pages/ClusterRedirect.tsx";

test("sharding keeps every URL and respects the limit", () => {
  const items = Array.from({ length: 100001 }, (_, i) => ({ slug: "a" + i }));
  const s = shard(items);
  expect(s.length).toBe(3);
  expect(s.every((x) => x.length <= SHARD_SIZE)).toBe(true);
  expect(s.flat().length).toBe(100001);
});
test("news sitemap keeps only last 48h, no duplicates", () => {
  const now = Date.parse("2026-11-07T00:00:00Z");
  const rows = [
    { slug: "new", created_at: "2026-11-06T12:00:00Z" },
    { slug: "new", created_at: "2026-11-06T12:00:00Z" },
    { slug: "old", created_at: "2026-11-01T00:00:00Z" },
  ];
  expect(newsFilter(rows, now).map((r) => r.slug)).toEqual(["new"]);
});
test("dedupe drops repeated slugs", () => expect(dedupe([{ slug: "x" }, { slug: "x" }]).length).toBe(1));
test("/cluster/ai redirects to /ai", () => expect(clusterRedirectTarget("ai")).toBe("/ai"));
test("unknown cluster does not redirect", () => expect(clusterRedirectTarget("nope")).toBe(null));
test("news excludes drafts, future and invalid dates and includes exact 48h boundary", () => {
  const now = Date.parse("2026-11-08T00:00:00Z");
  expect(newsFilter([
    { slug: "boundary", created_at: "2026-11-06T00:00:00Z" },
    { slug: "future", created_at: "2026-11-09T00:00:00Z" },
    { slug: "bad", created_at: "invalid" },
    { slug: "draft", created_at: "2026-11-07T00:00:00Z", published: false },
  ], now).map(r => r.slug)).toEqual(["boundary"]);
});
test("Google News shards never exceed 1000 entries", () => {
  const parts = shard(Array.from({ length: 2001 }, (_, i) => i), NEWS_SHARD_SIZE);
  expect(parts.map(p => p.length)).toEqual([1000, 1000, 1]);
});
