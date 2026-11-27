// Offline contract. It is deliberately not wired to an Edge Function, gateway
// client, or article writer. Every provider attempt consumes one budget slot.
export const GENERATION_BUDGET = {
  max_source_articles: 2,
  max_drafts: 2,
  max_ai_calls: 2,
  max_retries: 0,
} as const;

type ClaimedCandidate = { id: string; source_key: string };
type GatewayResult<Content> = { ok: true; content: Content; usage?: unknown } | { ok: false; usage?: unknown };
type GatewayUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  gateway_cost: number | null;
  gateway_credits: number | null;
};

function observedUsage(raw: unknown): GatewayUsage {
  const usage = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const number = (field: string, integer: boolean) => {
    const value = usage[field];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      (!integer || Number.isSafeInteger(value)) ? value : null;
  };
  return {
    prompt_tokens: number("prompt_tokens", true),
    completion_tokens: number("completion_tokens", true),
    total_tokens: number("total_tokens", true),
    gateway_cost: number("cost", false),
    gateway_credits: number("credits", false),
  };
}

export async function runBoundedGeneration<Content>(
  input: { candidate_ids: readonly string[]; limit: number; auto_publish: boolean },
  adapters: {
    // Atomically recheck qualification/dedup against all articles and claim the
    // entire selection (including against overlapping or replayed runs).
    claim: (ids: readonly string[]) => Promise<ClaimedCandidate[]>;
    // Verify the selected source, current evidence and editorial usage rights without AI.
    verifyEvidence: (candidate: ClaimedCandidate) => Promise<string | null>;
    // Exactly one provider attempt, including no embeddings or enrichment.
    generateOnce: (candidate: ClaimedCandidate, evidence: string) => Promise<GatewayResult<Content>>;
    // Must save at most one draft and prevent concurrent duplicate writes.
    saveDraft: (draft: {
      candidate: ClaimedCandidate; content: Content; published: false; image_url: null;
    }) => Promise<void>;
  },
) {
  const ids = input?.candidate_ids;
  if (input?.auto_publish !== false || input.limit !== GENERATION_BUDGET.max_source_articles ||
      !Array.isArray(ids) || ids.length < 1 || ids.length > GENERATION_BUDGET.max_source_articles ||
      Array.from(ids).some(id => typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id)) ||
      new Set(ids).size !== ids.length) {
    throw new Error("invalid_generation_request");
  }

  const selectedIds = [...ids];
  const candidates = await adapters.claim(selectedIds);
  if (!Array.isArray(candidates) || candidates.length !== selectedIds.length ||
      Array.from(candidates).some((candidate, index) => candidate?.id !== selectedIds[index] ||
        typeof candidate.source_key !== "string" || !candidate.source_key.trim()) ||
      new Set(candidates.map(candidate => candidate.source_key)).size !== selectedIds.length) {
    throw new Error("invalid_candidate_claim");
  }
  const evidence: string[] = [];
  for (const candidate of candidates) {
    const sourceText = await adapters.verifyEvidence(candidate);
    if (typeof sourceText !== "string" || sourceText.length > 12000 ||
        [...sourceText.trim()].length < 800 || [...sourceText].length > 6000) {
      throw new Error("generation_evidence_unavailable");
    }
    evidence.push(sourceText);
  }

  const report = {
    unique_source_articles: candidates.length,
    ai_calls: 0,
    drafts_created: 0,
    published_articles: 0,
    retries: 0,
    usage: [] as { candidate_id: string; usage: GatewayUsage }[],
    failure: null as { candidate_id: string; reason: "gateway_failed" | "draft_write_unconfirmed" } | null,
  };

  for (const [index, candidate] of candidates.entries()) {
    let output: GatewayResult<Content>;
    report.ai_calls++;
    try {
      output = await adapters.generateOnce(candidate, evidence[index]);
    } catch {
      output = { ok: false };
    }
    report.usage.push({ candidate_id: candidate.id, usage: observedUsage(output?.usage) });
    if (output?.ok !== true || output.content == null) {
      report.failure = { candidate_id: candidate.id, reason: "gateway_failed" };
      break;
    }
    try {
      await adapters.saveDraft({ candidate, content: output.content, published: false, image_url: null });
      report.drafts_created++;
    } catch {
      report.failure = { candidate_id: candidate.id, reason: "draft_write_unconfirmed" };
      break;
    }
  }
  return report;
}
