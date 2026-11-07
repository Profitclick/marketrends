import { test, expect } from "bun:test";
import { shard, newsFilter, dedupe, SHARD_SIZE } from "./sitemap-lib.mjs";
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
