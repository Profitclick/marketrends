import { supabase } from "@/integrations/supabase/client";

const MAX_BOUNDED_IDS = 100;

const normalizeIds = (ids: string[]) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length > MAX_BOUNDED_IDS) {
    throw new Error(`Topic stats refresh exceeds bounded limit of ${MAX_BOUNDED_IDS}`);
  }
  return unique;
};

export async function getTopicIdsForArticles(articleIds: string[]): Promise<string[]> {
  const ids = normalizeIds(articleIds);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("article_topics")
    .select("topic_id")
    .in("article_id", ids);
  if (error) throw error;

  return normalizeIds((data || []).map((row) => row.topic_id));
}

async function invokeBoundedRefresh(body: { article_ids?: string[]; topic_ids?: string[] }) {
  const { data, error } = await supabase.functions.invoke("rebuild-topic-stats", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function refreshTopicStatsForArticleIds(articleIds: string[]) {
  const ids = normalizeIds(articleIds);
  if (!ids.length) return;
  await invokeBoundedRefresh({ article_ids: ids });
}

export async function refreshTopicStatsForTopicIds(topicIds: string[]) {
  const ids = normalizeIds(topicIds);
  if (!ids.length) return;
  await invokeBoundedRefresh({ topic_ids: ids });
}
