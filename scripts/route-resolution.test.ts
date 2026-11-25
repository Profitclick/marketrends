import { describe, expect, test } from "bun:test";
import { resolveLegacyClusterRoute } from "../src/lib/routeResolution";
import { CATEGORY_MAP, loadCategoryRouteData, type MarketrendsDataClient } from "../src/lib/routeData";
import {
  categoryMetadata,
  homepageMetadata,
  searchIntentMetadata,
} from "../src/lib/routeMetadata";

describe("framework-neutral route outcomes", () => {
  test("legacy cluster resolves to permanent canonical redirect", () => {
    expect(resolveLegacyClusterRoute("ai")).toEqual({
      status: "redirect",
      to: "/ai",
      statusCode: 308,
    });
  });

  test("unknown legacy cluster resolves to not_found", () => {
    expect(resolveLegacyClusterRoute("__missing__")).toEqual({ status: "not_found" });
  });

  test("invalid category fails closed before touching a data client", async () => {
    let touched = false;
    const client = new Proxy({}, {
      get() {
        touched = true;
        throw new Error("data client must not be used");
      },
    });
    const result = await loadCategoryRouteData(client as unknown as MarketrendsDataClient, "__missing__");
    expect(result).toEqual({ status: "not_found" });
    expect(touched).toBe(false);
  });
});

describe("route metadata stays production-canonical", () => {
  test("homepage metadata keeps the production canonical", () => {
    expect(homepageMetadata().canonicalUrl).toBe("https://marketrends.no/");
  });

  test("category metadata is deterministic and production-canonical", () => {
    const meta = categoryMetadata("teknologi-ai", CATEGORY_MAP["teknologi-ai"]);
    expect(meta.canonicalUrl).toBe("https://marketrends.no/kategori/teknologi-ai");
    expect(meta.title).toBe("Teknologi & AI - Norsk nyhetsportal");
  });

  test("intent metadata includes a published pillar breadcrumb without changing canonical host", () => {
    const meta = searchIntentMetadata({
      id: "intent-1",
      keyword: "AI investering",
      target_slug: "ai-investering",
      content_status: "published",
      intent_type: "informational",
      is_pillar: false,
      pillar_intent_id: "pillar-1",
      meta: { title: "AI-investering forklart", meta_description: "Test" },
      geo_blocks: {},
    }, {
      keyword: "AI",
      target_slug: "ai",
      content_status: "published",
    });
    expect(meta.canonicalUrl).toBe("https://marketrends.no/intent/ai-investering");
    expect(meta.breadcrumbs?.map((item) => item.url)).toContain("https://marketrends.no/intent/ai");
  });
});
