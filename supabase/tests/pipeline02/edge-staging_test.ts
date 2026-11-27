import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler } from "./serve-fixture.ts";

Deno.test("real Edge handler uses only local PostgREST and fixed RSS fixtures", async () => {
  const api = Deno.env.get("PIPELINE_STAGE_API") ?? "";
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(api), "only isolated loopback PostgREST is allowed");
  const b64url = (raw: string) => btoa(raw).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
  const jwt = async (role: string, sub?: string) => {
    const segments = [b64url('{"alg":"HS256"}'), b64url(JSON.stringify({ role, sub }))].join(".");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(
      "marketrends-local-fixture-secret-32-bytes-only",
    ), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(segments));
    return segments + "." + b64url(String.fromCharCode(...new Uint8Array(sig)));
  };
  const service = await jwt("service_role");
  const authenticated = await jwt("authenticated");
  const admin = await jwt("authenticated", "00000000-0000-0000-0000-000000000010");
  const nativeFetch = globalThis.fetch;
  Deno.env.set("SUPABASE_URL", api);
  Deno.env.set("SUPABASE_ANON_KEY", await jwt("anon"));
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", service);
  Deno.env.set("EDITORIAL_CANDIDATE_REGISTRY_ENABLED", "true");
  Deno.env.set("CRON_SECRET", "fixture-cron-only");

  // A fixed literal timestamp is used. Its age affects the score but never
  // changes these fixture outcomes, even after the pilot freshness window.
  const item = (url: string) => `<item><title>Bitcoin crypto startup IPO and regulation in Norway</title>
    <link>${url}</link><pubDate>Sun, 01 Jan 2023 10:00:00 GMT</pubDate>
    <description>${"bitcoin fintech bitcoin etf regulation economic analysis. ".repeat(22)}</description></item>`;
  const feeds = new Map([
    ["https://feed-a.invalid/rss", ["https://source.invalid/repeat?utm_source=a",
      "https://source.invalid/published", "ftp://source.invalid/no"].map(item).join("")],
    ["https://feed-b.invalid/rss", ["https://source.invalid/repeat", "https://source.invalid/draft",
      "https://source.invalid/other"].map(item).join("")],
  ]);
  let releaseFeed: () => void = () => {};
  let reachedFeed: () => void = () => {};
  let gate: Promise<void> | null = null;
  const unexpected: string[] = [];
  globalThis.fetch = async (resource, init) => {
    const req = new Request(resource, init);
    const url = new URL(req.url);
    if (feeds.has(req.url)) {
      reachedFeed();
      await gate;
      return new Response(`<rss><channel>${feeds.get(req.url)}</channel></rss>`);
    }
    if (url.origin === api && url.pathname === "/auth/v1/user" &&
        req.headers.get("authorization") === "Bearer fixture-admin") {
      return Response.json({ id: "00000000-0000-0000-0000-000000000010", aud: "authenticated" });
    }
    if (url.origin === api && url.pathname.startsWith("/rest/v1/")) {
      url.pathname = url.pathname.slice("/rest/v1".length);
      return await nativeFetch(new Request(url, req));
    }
    unexpected.push(url.origin + url.pathname);
    throw new Error("network blocked by staging fixture");
  };

  async function call(body: object, headers: Record<string, string> = { Authorization: "Bearer fixture-admin" }) {
    assert(handler, "Edge entry module must register its handler");
    const response = await handler(new Request("http://edge.invalid/", {
      method: "POST", headers, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  }
  try {
    await import("../../functions/fetch-and-process-feeds/index.ts");
    assertEquals((await call({ registry_only: true }, { "x-cron-secret": "fixture-cron-only" })).status, 403);
    assertEquals((await call({ registry_only: true }, {})).status, 401);
    Deno.env.set("EDITORIAL_CANDIDATE_REGISTRY_ENABLED", "false");
    assertEquals((await call({ registry_only: true })).status, 400);
    Deno.env.set("EDITORIAL_CANDIDATE_REGISTRY_ENABLED", "true");

    const entered = new Promise<void>(resolve => { reachedFeed = resolve; });
    gate = new Promise<void>(resolve => { releaseFeed = resolve; });
    const pending = call({ registry_only: true });
    try {
      await Promise.race([
        entered, pending.then(result => { throw new Error(`first request exited: ${JSON.stringify(result)}`); }),
      ]);
      assertEquals((await call({ registry_only: true })).status, 409);
    } finally {
      releaseFeed();
      gate = null;
    }
    const first = await pending;
    const second = await call({ registry_only: true });
    for (const [result, added, known] of [[first, 4, 0], [second, 0, 4]] as const) {
      assertEquals(result.status, 200);
      const { body } = result;
      assertEquals(body.rss_observations, 6);
      assertEquals(body.unique_source_articles, 4);
      assertEquals(body.new_candidates, added);
      assertEquals(body.known_candidates, known);
      assertEquals(body.qualified_candidates, 2);
      assertEquals(body.rejected_candidates, 2);
      assertEquals(body.unidentified_observations, { invalid_source_url: 1 });
      assertEquals([body.ai_calls, body.drafts_created, body.published_articles], [0, 0, 0]);
      console.log(JSON.stringify({ rss: body.rss_observations, unique: body.unique_source_articles, added, known,
        qualified: body.qualified_candidates, rejected: body.rejected_candidates, invalid: body.unidentified_observations,
        ai: body.ai_calls, drafts: body.drafts_created, published: body.published_articles }));
    }

    const fetchOnly = await call({ fetch_only: true }, { "x-cron-secret": "fixture-cron-only" });
    assertEquals(fetchOnly.status, 200);
    assertEquals(Object.keys(fetchOnly.body).sort(), [
      "ai_calls", "articles_auto_published", "articles_created", "dry_run", "feeds", "fetch_only",
      "items_above_threshold", "total_items_collected",
    ]);
    assertEquals(fetchOnly.body.total_items_collected, 6);
    assertEquals([fetchOnly.body.ai_calls, fetchOnly.body.articles_created, fetchOnly.body.articles_auto_published], [0, 0, 0]);
    for (const role of [null, authenticated, admin]) {
      const headers = role ? { Authorization: `Bearer ${role}` } : undefined;
      for (const resource of ["editorial_candidates", "editorial_candidate_observations", "editorial_generation_pilot",
        "editorial_generation_reservations", "rpc/record_editorial_candidate_batch", "rpc/reserve_editorial_generation"]) {
        const response = await nativeFetch(`${api}/${resource}`, resource.startsWith("rpc/")
          ? { method: "POST", headers: { ...headers, "Content-Type": "application/json" },
            body: resource.endsWith("batch") ? '{"_run_id":null,"_items":[]}' : '{"_pilot_id":null,"_request_id":null,"_selection":[]}' }
          : { headers });
        const error = await response.json();
        assert([401, 403, 404].includes(response.status), `${resource}: ${JSON.stringify(error)}`);
      }
    }
    assertEquals(unexpected, []);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
