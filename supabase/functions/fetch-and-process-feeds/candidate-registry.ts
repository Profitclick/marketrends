export const CANDIDATE_REGISTRY_JOB = "editorial-candidate-registry";

export function parsePipelineRequest(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  if (!raw.trim()) return {};
  try {
    const body = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function registryRequest(
  body: unknown,
  actor: string,
  enabled: boolean,
): { registryOnly: boolean; error?: "invalid_pipeline_request" | "registry_disabled" | "registry_requires_admin" | "bounded_generation_not_enabled" } {
  if (!body || typeof body !== "object") return { registryOnly: false };
  const input = body as Record<string, unknown>;
  if ("registry_only" in input) {
    if (input.registry_only !== true || Object.keys(input).some(key => key !== "registry_only")) {
      return { registryOnly: false, error: "invalid_pipeline_request" };
    }
    if (actor !== "admin") return { registryOnly: false, error: "registry_requires_admin" };
    if (!enabled) return { registryOnly: false, error: "registry_disabled" };
    return { registryOnly: true };
  }

  // Preserve the existing no-generation mode contracts. Avoid treating explicit
  // selections or budgets as a request to run the older, unbounded-by-request mode.
  if (input.dry_run !== true && input.fetch_only !== true &&
      ("candidate_ids" in input || "limit" in input)) {
    return { registryOnly: false, error: "bounded_generation_not_enabled" };
  }
  return { registryOnly: false };
}

export function candidateObservation(entry: {
  feedId: string;
  preScore: number;
  item: { link: string; title: string; pubDate: string };
}, evidence: string) {
  return {
    feed_id: entry.feedId,
    source_url: entry.item.link.length <= 2048 ? entry.item.link : null,
    title: entry.item.title.slice(0, 300),
    published_at: sourcePublicationTime(entry.item.pubDate.trim()),
    pre_score: Number.isFinite(entry.preScore) ? entry.preScore : null,
    evidence_chars: Math.min([...evidence.slice(0, 12000)].length, 6000),
  };
}

const RSS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sourcePublicationTime(raw: string): string | null {
  // Check the calendar before Date.parse, which can roll invalid dates into the next month.
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:?\d{2})$/.exec(raw);
  const rss = /^(?:[A-Za-z]{3}, )?(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d (?:GMT|UTC|[+-]\d{4})$/.exec(raw);
  if (!iso && !rss) return null;
  const year = Number(iso?.[1] ?? rss?.[3]);
  const month = iso ? Number(iso[2]) : RSS_MONTHS.indexOf(rss?.[2] ?? "") + 1;
  const day = Number(iso?.[3] ?? rss?.[1]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return null;
  }
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
