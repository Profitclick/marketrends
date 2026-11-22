import { expect, test } from "bun:test";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const wiredPages = [
  ["src/pages/NewsView.tsx", "loadNewsRouteData"],
  ["src/pages/CategoryPage.tsx", "loadCategoryRouteData"],
  ["src/pages/TopicPage.tsx", "loadTopicRouteData"],
  ["src/pages/EntityPage.tsx", "loadEntityRouteData"],
  ["src/pages/GuidePage.tsx", "loadGuideRouteData"],
  ["src/pages/KnowledgePage.tsx", "loadKnowledgeRouteData"],
  ["src/pages/ComparePage.tsx", "loadCompareRouteData"],
  ["src/pages/SearchIntentPage.tsx", "loadSearchIntentRouteData"],
] as const;

test("dynamic route pages delegate database loading to routeData", () => {
  for (const [path, loader] of wiredPages) {
    const source = read(path);
    expect(source).toContain(loader);
    expect(source).not.toMatch(/\.from\(\s*["']/);
  }
});

test("legacy cluster page delegates route policy to framework-neutral resolver", () => {
  const source = read("src/pages/ClusterRedirect.tsx");
  expect(source).toContain("resolveLegacyClusterRoute");
  expect(source).not.toContain('from "@/config/clusters"');
});

test("routeData owns all dynamic public route table lookups", () => {
  const source = read("src/lib/routeData.ts");
  for (const table of [
    "articles",
    "topics",
    "entities",
    "guides",
    "knowledge_pages",
    "comparison_pages",
    "search_intents",
  ]) {
    expect(source).toContain(`.from("${table}")`);
  }
});
