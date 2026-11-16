export const DAY_MS = 86_400_000;

export interface TopicStatsTopic {
  name: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface TopicStatsRelation {
  relevance_score: number | null;
  articles: {
    id: string;
    created_at: string;
    published: boolean;
    article_type: string | null;
  } | null;
}

export interface ComputedTopicStats {
  article_count: number;
  last_article_at: string | null;
  articles_last_7d: number;
  articles_last_30d: number;
  trending_score: number;
  hero_article_id: string | null;
  explainer_article_id: string | null;
  meta_title: string;
  meta_description: string;
}

export function computeTopicStats(
  topic: TopicStatsTopic,
  rows: TopicStatsRelation[],
  now = Date.now(),
): ComputedTopicStats {
  const published = rows.filter((row) => row.articles?.published);
  const articleCount = published.length;
  const timestamps = published
    .map((row) => new Date(row.articles!.created_at).getTime())
    .filter(Number.isFinite);

  const lastArticleAt = timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;

  const articlesLast7d = timestamps.filter((value) => value >= now - 7 * DAY_MS).length;
  const articlesLast30d = timestamps.filter((value) => value >= now - 30 * DAY_MS).length;

  const recencyDays = lastArticleAt
    ? (now - new Date(lastArticleAt).getTime()) / DAY_MS
    : 999;
  const recencyBoost = Math.max(0, 14 - recencyDays) / 14;
  const trendingScore =
    0.5 * articlesLast7d +
    0.3 * Math.max(0, articlesLast30d - articlesLast7d) / 3 +
    2.0 * recencyBoost;

  const ranked = [...published].sort((a, b) => {
    const aTime = new Date(a.articles!.created_at).getTime();
    const bTime = new Date(b.articles!.created_at).getTime();
    const aRank = aTime >= now - 7 * DAY_MS ? 2 : aTime >= now - 30 * DAY_MS ? 1 : 0;
    const bRank = bTime >= now - 7 * DAY_MS ? 2 : bTime >= now - 30 * DAY_MS ? 1 : 0;
    if (bRank !== aRank) return bRank - aRank;
    return (b.relevance_score || 0) - (a.relevance_score || 0);
  });

  const heroArticleId = ranked[0]?.articles?.id || null;
  const explainerArticleId = published
    .filter((row) => row.articles?.article_type === "guide")
    .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))[0]
    ?.articles?.id || null;

  const freshLabel =
    recencyDays < 1
      ? "Oppdatert i dag"
      : recencyDays < 7
        ? "Oppdatert denne uken"
        : "Oppdateres jevnlig";

  return {
    article_count: articleCount,
    last_article_at: lastArticleAt,
    articles_last_7d: articlesLast7d,
    articles_last_30d: articlesLast30d,
    trending_score: trendingScore,
    hero_article_id: heroArticleId,
    explainer_article_id: explainerArticleId,
    meta_title: topic.meta_title || `${topic.name} – nyheter, analyse og forklaring | Marketrends.no`,
    meta_description:
      topic.meta_description ||
      `Følg ${topic.name} på Marketrends. ${articleCount} artikler. ${freshLabel}. Norsk dekning av ${topic.name.toLowerCase()}.`,
  };
}
