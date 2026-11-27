import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { candidateObservation, parsePipelineRequest, registryRequest } from "./candidate-registry.ts";
import { runBoundedGeneration } from "./bounded-generation.ts";

Deno.test("only an explicitly enabled admin can enter registry mode", () => {
  assertEquals(registryRequest({ registry_only: true }, "admin", true), { registryOnly: true });
  for (const actor of ["cron", "service_role"]) {
    assertEquals(registryRequest({ registry_only: true }, actor, true).error, "registry_requires_admin");
  }
  assertEquals(registryRequest({ registry_only: true }, "admin", false).error, "registry_disabled");
  for (const extra of [{ auto_publish: false }, { dry_run: true }, { fetch_only: true }, { limit: 2 }]) {
    assertEquals(registryRequest({ registry_only: true, ...extra }, "admin", true).error, "invalid_pipeline_request");
  }
  assertEquals(registryRequest({ fetch_only: true, limit: 2 }, "cron", true), { registryOnly: false });
  assertEquals(registryRequest({ dry_run: true, limit: 2 }, "admin", true), { registryOnly: false });
  assertEquals(registryRequest({ limit: 2 }, "admin", true).error, "bounded_generation_not_enabled");
  assertEquals(registryRequest({ candidate_ids: ["unwired"] }, "admin", true).error, "bounded_generation_not_enabled");
});

Deno.test("malformed selection cannot fall through to legacy generation", () => {
  assertEquals(parsePipelineRequest(""), {});
  assertEquals(parsePipelineRequest('{"fetch_only":true}'), { fetch_only: true });
  for (const body of [null, "null", "[]", "true", '{"registry_only":']) {
    assertEquals(parsePipelineRequest(body), null);
  }
});

Deno.test("observations keep bounded provenance and turn invalid evidence into null", () => {
  const entry = {
    feedId: "feed",
    preScore: 0.7,
    item: { link: "https://source.test/story", title: "Title", pubDate: "Thu, 26 Nov 2026 14:00:00 +0100" },
  };
  assertEquals(candidateObservation(entry, "x".repeat(6050)), {
    feed_id: "feed", pre_score: 0.7, source_url: entry.item.link,
    title: "Title", published_at: "2026-11-26T13:00:00.000Z", evidence_chars: 6000,
  });
  assertEquals(candidateObservation({
    ...entry, preScore: NaN, item: { ...entry.item, link: "x".repeat(2050), pubDate: "2026-11-26 14:00:00" },
  }, ""), {
    feed_id: "feed", pre_score: null, source_url: null,
    title: "Title", published_at: null, evidence_chars: 0,
  });
  assertEquals(candidateObservation({
    ...entry, item: { ...entry.item, pubDate: "2026-02-30T12:00:00Z" },
  }, "source").published_at, null);
});

const first = "a".repeat(64);
const second = "b".repeat(64);
const request = {
  pilot_id: "11111111-0000-0000-0000-000000000001",
  request_id: "11111111-0000-0000-0000-000000000002",
  candidate_ids: [first, second], limit: 2, auto_publish: false,
};

function fixture() {
  const remaining = new Set([first, second]);
  const completed: unknown[] = [];
  const calls: string[] = [];
  return {
    completed,
    calls,
    adapters: {
      inspect(ids: readonly string[]) {
        calls.push("inspect");
        return Promise.resolve(ids.map(id => ({ id, source_key: "feed.test/" + id })));
      },
      verifyEvidence(candidate: { id: string; source_key: string }) {
        calls.push("evidence:" + candidate.id);
        const now = new Date().toISOString();
        return Promise.resolve({
          text: "verified source text ".repeat(45), source_key: candidate.source_key,
          evidence_verified_at: now, source_published_at: now, editorial_approved: true,
        });
      },
      reserve(_pilotId: string, _requestId: string, selection: { id: string }[]) {
        calls.push("reserve");
        if (selection.some(({ id }) => !remaining.has(id))) {
          return Promise.reject(new Error("pilot_request_replayed"));
        }
        for (const { id } of selection) remaining.delete(id);
        return Promise.resolve(selection.map(({ id }, i) => ({ id, source_key: "feed.test/" + id, slot: i + 1 })));
      },
      generateOnce(candidate: { id: string }) {
        calls.push("gateway:" + candidate.id);
        return Promise.resolve({ ok: true as const, content: "fixture draft", usage: {
          prompt_tokens: 35, completion_tokens: 15, total_tokens: 50, credits: 0.1,
        } });
      },
      saveDraft(row: unknown) {
        completed.push(row);
        return Promise.resolve();
      },
    },
  };
}

Deno.test("manual contract caps source articles, attempts and drafts and forbids publication and images", async () => {
  const f = fixture();
  const report = await runBoundedGeneration(request, f.adapters);
  assertEquals(report.unique_source_articles, 2);
  assertEquals(report.ai_calls, 2);
  assertEquals(report.drafts_created, 2);
  assertEquals(report.published_articles, 0);
  assertEquals(report.retries, 0);
  assertEquals(f.calls, ["inspect", "evidence:" + first, "evidence:" + second, "reserve", "gateway:" + first, "gateway:" + second]);
  assertEquals(f.completed.map(row => {
    const { published, image_url } = row as { published: boolean; image_url: string | null };
    return [published, image_url];
  }), [[false, null], [false, null]]);
  assertEquals(report.usage[0].usage, {
    prompt_tokens: 35, completion_tokens: 15, total_tokens: 50, gateway_cost: null, gateway_credits: 0.1,
  });
  await assertRejects(() => runBoundedGeneration(request, f.adapters), Error, "pilot_request_replayed");
  assertEquals(f.completed.length, 2);
});

Deno.test("invalid selection, duplicate source or missing evidence blocks all generation", async () => {
  const f = fixture();
  for (const input of [
    { ...request, auto_publish: true }, { ...request, limit: 8 },
    { ...request, candidate_ids: [first, first] },
    { ...request, candidate_ids: [first, second, "c".repeat(64)] },
    { ...request, candidate_ids: [first, "not-an-id"] },
  ]) await assertRejects(() => runBoundedGeneration(input, f.adapters), Error, "invalid_generation_request");
  assertEquals(f.calls, []);
  await assertRejects(() => runBoundedGeneration(request, {
    ...f.adapters, inspect: ids => Promise.resolve(ids.map(id => ({ id, source_key: "same" }))),
  }), Error, "invalid_candidate_selection");
  assertEquals(f.calls, []);
  await assertRejects(() => runBoundedGeneration(request, {
    ...f.adapters, verifyEvidence: candidate => candidate.id === first
      ? f.adapters.verifyEvidence(candidate) : Promise.resolve(null),
  }), Error, "generation_evidence_unavailable");
  assertEquals(f.calls, ["inspect", "evidence:" + first]);
});

Deno.test("provider and write failures stop the batch with zero retries and data only from actual usage fields", async () => {
  const f = fixture();
  const failed = await runBoundedGeneration(request, {
    ...f.adapters, generateOnce: () => Promise.resolve({ ok: false, usage: {
      total_tokens: 5, cost: 0.004, prompt_tokens: "5", completion_tokens: -1, credits: Infinity,
    } }),
  });
  assertEquals(failed.failure, { candidate_id: first, reason: "gateway_failed" });
  assertEquals(failed.ai_calls, 1);
  assertEquals(failed.drafts_created, 0);
  assertEquals(failed.retries, 0);
  assertEquals(failed.usage[0].usage, {
    total_tokens: 5, gateway_cost: 0.004, completion_tokens: null, prompt_tokens: null, gateway_credits: null,
  });

  const g = fixture();
  const write = await runBoundedGeneration(request, {
    ...g.adapters, saveDraft: () => Promise.reject(new Error("ambiguous write")),
  });
  assertEquals(write.failure, { candidate_id: first, reason: "draft_write_unconfirmed" });
  assertEquals(write.ai_calls, 1);
  assertEquals(write.drafts_created, 0);
  assertEquals(g.calls.filter(call => call.startsWith("gateway:")).length, 1);
});

Deno.test("old publication, stale evidence, unmatched sources and missing approval fail before reservation", async () => {
  for (const patch of [
    { source_published_at: "2021-01-01T00:00:00.000Z" },
    { evidence_verified_at: "2021-01-01T00:00:00.000Z" },
    { source_key: "different-source" },
    { editorial_approved: false },
  ]) {
    const f = fixture();
    await assertRejects(() => runBoundedGeneration(request, {
      ...f.adapters, verifyEvidence: async candidate => ({ ...await f.adapters.verifyEvidence(candidate), ...patch }),
    }), Error, "generation_source_not_current");
    assertEquals(f.calls, ["inspect", "evidence:" + first]);
  }
});
