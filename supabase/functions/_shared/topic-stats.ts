import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeTopicStats, type TopicStatsRelation } from "./topic-stats-core.ts";

export const MAX_BOUNDED_TOPIC_IDS = 100;

export function normalizeBoundedIds(
  values: unknown,
  label = "ids",
  max = MAX_BOUNDED_TOPIC_IDS,
): string[] {
  if (!Array.isArray(values)) return [];
  const ids = [...new Set(values.filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  ).map((value) => value.trim()))];
  if (ids.length > max) throw new Error(`${label} exceeds bounded limit of ${max}`);
  return ids;
}

export async function refreshTopicStats(
  supabase: SupabaseClient,
  topicIds: string[],
  now = Date.now(),
): Promise<{ updated: number; topicArticleSets: Map<string, Set<string>> }> {
  const ids = normalizeBoundedIds(topicIds, "topic_ids");
  if (!ids.length) return { updated: 0, topicArticleSets: new Map() };

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, name, meta_title, meta_description")
    .in("id", ids);
  if (topicsError) throw topicsError;

  let updated = 0;
  const topicArticleSets = new Map<string, Set<string>>();

  for (const topic of topics || []) {
    const { data: rows, error: rowsError } = await supabase
      .from("article_topics")
      .select("relevance_score, articles!inner(id, created_at, published, article_type)")
      .eq("topic_id", topic.id);
    if (rowsError) throw rowsError;

    const relations = (rows || []) as TopicStatsRelation[];
    const stats = computeTopicStats(topic, relations, now);
    topicArticleSets.set(
      topic.id,
      new Set(
        relations
          .filter((row) => row.articles?.published)
          .map((row) => row.articles!.id),
      ),
    );

    const { error: updateError } = await supabase
      .from("topics")
      .update(stats)
      .eq("id", topic.id);
    if (updateError) throw updateError;
    updated++;
  }

  return { updated, topicArticleSets };
}
