// Offline contract. It is deliberately not wired to an Edge Function, gateway
// client, or article writer. Every provider attempt consumes one budget slot.
export const GENERATION_BUDGET = {
  max_source_articles: 2,
  max_drafts: 2,
  max_ai_calls: 2,
  max_retries: 0,
} as const;

type SelectedCandidate = { id: string; source_key: string };
type ReservedCandidate = SelectedCandidate & { slot: number };
type VerifiedEvidence = {
  source_key: string; source_published_at: string; evidence_verified_at: string;
  text: string; editorial_approved: boolean;
};
type ReservationSelection = Pick<VerifiedEvidence, "source_published_at" | "evidence_verified_at"> & { id: string };
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
  input: { pilot_id: string; request_id: string; candidate_ids: readonly string[]; limit: number; auto_publish: boolean },
  adapters: {
    inspect: (ids: readonly string[]) => Promise<SelectedCandidate[]>;
    // Verify the selected source, current evidence and editorial usage rights without AI.
    verifyEvidence: (candidate: SelectedCandidate) => Promise<VerifiedEvidence | null>;
    // Call reserve_editorial_generation once, before any gateway attempt.
    reserve: (pilotId: string, requestId: string, selection: ReservationSelection[]) => Promise<ReservedCandidate[]>;
    // Exactly one provider attempt, including no embeddings or enrichment.
    generateOnce: (candidate: ReservedCandidate, evidence: string) => Promise<GatewayResult<Content>>;
    // Must save at most one draft and prevent concurrent duplicate writes.
    saveDraft: (draft: {
      candidate: ReservedCandidate; content: Content; published: false; image_url: null;
    }) => Promise<void>;
  },
) {
  const ids = input?.candidate_ids;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (input?.auto_publish !== false || input.limit !== GENERATION_BUDGET.max_source_articles ||
      !uuid.test(input.pilot_id) || !uuid.test(input.request_id) ||
      !Array.isArray(ids) || ids.length < 1 || ids.length > GENERATION_BUDGET.max_source_articles ||
      Array.from(ids).some(id => typeof id !== "string" || !/^[0-9a-f]{64}$/.test(id)) ||
      new Set(ids).size !== ids.length) {
    throw new Error("invalid_generation_request");
  }

  const selectedIds = [...ids];
  const selected = await adapters.inspect(selectedIds);
  if (!Array.isArray(selected) || selected.length !== selectedIds.length ||
      Array.from(selected).some((candidate, index) => candidate?.id !== selectedIds[index] ||
        typeof candidate.source_key !== "string" || !candidate.source_key.trim()) ||
      new Set(selected.map(candidate => candidate.source_key)).size !== selectedIds.length) {
    throw new Error("invalid_candidate_selection");
  }
  const evidence: string[] = [];
  const selection: ReservationSelection[] = [];
  for (const candidate of selected) {
    const verified = await adapters.verifyEvidence(candidate);
    const sourceText = verified?.text;
    if (!verified || typeof sourceText !== "string" || sourceText.length > 12000 ||
        [...sourceText.trim()].length < 800 || [...sourceText].length > 6000) {
      throw new Error("generation_evidence_unavailable");
    }
    const now = Date.now();
    if (verified.editorial_approved !== true || verified.source_key !== candidate.source_key ||
        !isRecentUtc(verified.source_published_at, now, 72 * 60 * 60_000) ||
        !isRecentUtc(verified.evidence_verified_at, now, 15 * 60_000)) {
      throw new Error("generation_source_not_current");
    }
    evidence.push(sourceText);
    selection.push({
      id: candidate.id, source_published_at: verified.source_published_at,
      evidence_verified_at: verified.evidence_verified_at,
    });
  }
  const candidates = await adapters.reserve(input.pilot_id, input.request_id, selection);
  if (!Array.isArray(candidates) || candidates.length !== selected.length ||
      Array.from(candidates).some((candidate, index) =>
        candidate?.id !== selected[index].id || candidate.source_key !== selected[index].source_key ||
        (candidate.slot !== 1 && candidate.slot !== 2)) ||
      new Set(candidates.map(candidate => candidate.slot)).size !== selected.length) {
    throw new Error("invalid_pilot_reservation");
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

function isRecentUtc(value: string, now: number, maxAge: number): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now && now - parsed <= maxAge &&
    new Date(parsed).toISOString() === value;
}
