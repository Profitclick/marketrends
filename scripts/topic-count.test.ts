import { test, expect } from "bun:test";
import { getDisplayedTopicArticleCount } from "../src/utils/topicCounts";

test("falls back to loaded published memberships when materialized count is stale zero", () => {
  expect(getDisplayedTopicArticleCount(0, 8)).toBe(8);
});

test("keeps authoritative materialized total above the loaded 60-row window", () => {
  expect(getDisplayedTopicArticleCount(125, 60)).toBe(125);
});

test("keeps a valid zero when no published memberships are loaded", () => {
  expect(getDisplayedTopicArticleCount(0, 0)).toBe(0);
});

test("does not replace a non-zero materialized total with a partial loaded count", () => {
  expect(getDisplayedTopicArticleCount(42, 18)).toBe(42);
});
