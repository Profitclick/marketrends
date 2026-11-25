import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { routeFound, routeNotFound, type RouteResolution } from "@/lib/routeResolution";
import { getCluster, type ClusterConfig } from "@/config/clusters";

export type MarketrendsDataClient = SupabaseClient<Database>;

export type SerializableJson =
  | null
  | boolean
  | number
  | string
  | SerializableJson[]
  | { [key: string]: SerializableJson };

export interface RouteArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  source_name: string;
  source_url: string;
  category: string;
  tags: string[];
  meta_description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at?: string | null;
  published: boolean;
  is_affiliate?: boolean;
  risk_warning?: string | null;
  archived_sources?: string[] | null;
  article_type?: string | null;
  affiliate_partners?: { name: string } | null;
}

export interface CategoryArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  meta_description: string | null;
  image_url: string | null;
  created_at: string;
  article_type: string | null;
  tags: string[] | null;
}

export interface CategoryDefinition {
  name: string;
  description: string;
  keywords: string;
}

export const CATEGORY_MAP: Record<string, CategoryDefinition> = {
  "krypto-trading": {
    name: "Krypto & Trading",
    description: "Siste nytt om kryptovaluta, Bitcoin, Ethereum, trading og DeFi. Norske perspektiver på det globale kryptomarkedet.",
    keywords: "krypto, bitcoin, ethereum, trading, kryptovaluta, DeFi, blockchain",
  },
  "teknologi-ai": {
    name: "Teknologi & AI",
    description: "Nyheter om kunstig intelligens, teknologi, SaaS og digital transformasjon. AI-verktøy og tech-innovasjon.",
    keywords: "teknologi, AI, kunstig intelligens, SaaS, tech, software, innovasjon",
  },
  "finans-marked": {
    name: "Finans & Marked",
    description: "Fintech-nyheter, bankinnovasjon, investering og markedsanalyse. Oslo Børs og norsk økonomi.",
    keywords: "finans, fintech, bank, investering, Oslo Børs, marked, økonomi",
  },
  "grunder-startups": {
    name: "Gründer & Startups",
    description: "Inspirerende gründerhistorier, startup-nyheter og venture capital. Norsk innovasjon og entrepreneurskap.",
    keywords: "gründer, startup, venture, innovasjon, entreprenør, oppstart",
  },
  "penger-karriere": {
    name: "Penger & Karriere",
    description: "Personlig økonomi, karrieretips og jobbmarked. Slik tjener du mer og bygger din karriere.",
    keywords: "penger, karriere, lønn, jobb, personlig økonomi, sparing",
  },
  "trender-analyse": {
    name: "Trender & Analyse",
    description: "Dyptgående markedsanalyser, trender og data. Forstå hva som driver markedene.",
    keywords: "trender, analyse, marked, data, innsikt, research",
  },
  "guider-forklart": {
    name: "Guider & Forklart",
    description: "Praktiske guider og forklaringer. Lær hvordan du navigerer finans, krypto og tech.",
    keywords: "guide, hvordan, forklart, veiledning, tips, råd",
  },
};

export interface TopicRouteTopic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_hint: string | null;
  article_count: number;
  articles_last_7d: number;
  meta_title: string | null;
  meta_description: string | null;
  hero_article_id: string | null;
  explainer_article_id: string | null;
  last_article_at: string | null;
  og_image: string | null;
}

export interface TopicRouteArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  meta_description: string | null;
  image_url: string | null;
  created_at: string;
  source_name: string;
  article_type: string | null;
}

export interface TopicRouteEntity {
  id: string;
  slug: string;
  name: string;
  type: string;
  mention_count: number;
}

export interface TopicRouteData {
  topic: TopicRouteTopic;
  articles: TopicRouteArticle[];
  hero: TopicRouteArticle | null;
  explainer: TopicRouteArticle | null;
  entities: TopicRouteEntity[];
}

export interface EntityRouteEntity {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  summary: string | null;
  key_facts: SerializableJson;
  faqs: SerializableJson;
  what_happened: string | null;
  why_it_matters: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  aliases: string[];
  mention_count: number;
  mentions_last_24h: number;
  mentions_last_7d: number;
  mentions_last_30d: number;
  momentum_score: number;
  trending_score: number;
  last_mention_at: string | null;
  wikidata_id: string | null;
}

export interface NewsRouteData {
  mode: "homepage" | "article";
  articles: RouteArticle[];
  selectedArticle: RouteArticle | null;
}

export interface CategoryRouteData {
  category: CategoryDefinition;
  articles: CategoryArticle[];
  isFallback: boolean;
}

export interface EntityRouteData {
  entity: EntityRouteEntity;
}


type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
type EntityRow = Database["public"]["Tables"]["entities"]["Row"];
type GuideRow = Database["public"]["Tables"]["guides"]["Row"];
type KnowledgeRow = Database["public"]["Tables"]["knowledge_pages"]["Row"];
type ComparisonRow = Database["public"]["Tables"]["comparison_pages"]["Row"];
type ClusterStatsRow = Database["public"]["Tables"]["cluster_stats"]["Row"];

export type ClusterRouteArticle = ArticleRow & {
  article_clusters: { cluster_slug: string }[];
};

export type ClusterRouteTopic = Pick<
  TopicRow,
  "id" | "name" | "slug" | "authority_score" | "trending_score" | "article_count"
>;

export type ClusterRouteEntity = Pick<
  EntityRow,
  "id" | "name" | "slug" | "authority_score" | "mention_count"
>;

export type ClusterRouteGuide = Pick<GuideRow, "slug" | "title" | "summary">;
export type ClusterRouteKnowledge = Pick<KnowledgeRow, "slug" | "title" | "summary" | "topic_id" | "entity_id">;
export type ClusterRouteComparison = Pick<
  ComparisonRow,
  "slug" | "title" | "summary" | "entity_a_id" | "entity_b_id"
>;

export interface ClusterRouteData {
  cluster: ClusterConfig;
  stats: ClusterStatsRow | null;
  articles: ClusterRouteArticle[];
  topics: ClusterRouteTopic[];
  entities: ClusterRouteEntity[];
  guides: ClusterRouteGuide[];
  knowledge: ClusterRouteKnowledge[];
  comparisons: ClusterRouteComparison[];
}

const latestArticleSelect =
  "id, title, slug, source_name, source_url, category, tags, meta_description, image_url, created_at, published, is_affiliate, risk_warning, article_type, affiliate_partners(name)";

export async function loadNewsRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<NewsRouteData>> {
  let selectedArticle: RouteArticle | null = null;

  if (slug) {
    const { data, error } = await client
      .from("articles")
      .select("*, affiliate_partners(name)")
      .eq("published", true)
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return routeNotFound();

    selectedArticle = {
      ...(data as unknown as RouteArticle),
      archived_sources: (data.archived_sources as string[] | null) ?? null,
    };
  }

  const { data, error } = await client
    .from("articles")
    .select(latestArticleSelect)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const articles = ((data || []) as unknown as RouteArticle[]).map((article) => ({
    ...article,
    content: "",
    archived_sources: null,
  }));

  return routeFound({
    mode: slug ? "article" : "homepage",
    articles,
    selectedArticle,
  });
}

export async function loadCategoryRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<CategoryRouteData>> {
  const category = slug ? CATEGORY_MAP[slug] : null;
  if (!category) return routeNotFound();

  const select = "id, title, slug, category, meta_description, image_url, created_at, article_type, tags";
  const primary = await client
    .from("articles")
    .select(select)
    .eq("published", true)
    .eq("category", category.name)
    .order("created_at", { ascending: false })
    .limit(24);

  if (!primary.error && primary.data?.length) {
    return routeFound({
      category,
      articles: primary.data as unknown as CategoryArticle[],
      isFallback: false,
    });
  }

  const fallback = await client
    .from("articles")
    .select(select)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(24);

  return routeFound({
    category,
    articles: (fallback.data || []) as unknown as CategoryArticle[],
    isFallback: true,
  });
}

export async function loadEntityRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<EntityRouteData>> {
  if (!slug) return routeNotFound();
  const { data, error } = await client
    .from("entities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return routeNotFound();
  return routeFound({ entity: data as unknown as EntityRouteEntity });
}

export async function loadTopicRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<TopicRouteData>> {
  if (!slug) return routeNotFound();

  const { data: topicData, error: topicError } = await client
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (topicError) throw topicError;
  if (!topicData) return routeNotFound();

  const { data: at } = await client
    .from("article_topics")
    .select("relevance_score, articles!inner(id, title, slug, category, tags, meta_description, image_url, created_at, source_name, article_type, published)")
    .eq("topic_id", topicData.id)
    .order("relevance_score", { ascending: false })
    .limit(60);

  type TopicArticleJoinRow = { articles: (TopicRouteArticle & { published?: boolean }) | null };
  const articles = ((at || []) as unknown as TopicArticleJoinRow[])
    .map((row) => row.articles)
    .filter((article) => article && article.published)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  let hero = topicData.hero_article_id
    ? articles.find((article) => article.id === topicData.hero_article_id) || null
    : null;
  if (!hero) hero = articles[0] || null;

  let explainer = topicData.explainer_article_id
    ? articles.find((article) => article.id === topicData.explainer_article_id) || null
    : null;
  if (!explainer) explainer = articles.find((article) => article.article_type === "guide") || null;

  const articleIds = articles.map((article) => article.id);
  let entities: TopicRouteEntity[] = [];

  if (articleIds.length) {
    const { data: ae } = await client
      .from("article_entities")
      .select("entity_id, entities!inner(id, slug, name, type, mention_count)")
      .in("article_id", articleIds)
      .limit(200);

    const counts = new Map<string, { entity: TopicRouteEntity; count: number }>();
    type TopicEntityJoinRow = { entities: TopicRouteEntity | null };
    for (const row of (ae || []) as unknown as TopicEntityJoinRow[]) {
      const entity = row.entities;
      if (!entity) continue;
      const current = counts.get(entity.id);
      if (current) current.count += 1;
      else counts.set(entity.id, { entity, count: 1 });
    }

    entities = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(({ entity }) => entity);
  }

  return routeFound({
    topic: topicData as unknown as TopicRouteTopic,
    articles,
    hero,
    explainer,
    entities,
  });
}


export interface GuideRoutePage {
  slug: string;
  title: string;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  category: string | null;
  estimated_read_time: number | null;
  difficulty: string | null;
  steps_json: SerializableJson;
  faq_json: SerializableJson;
  resources_json: SerializableJson;
  content: string | null;
}

export interface KnowledgeRoutePage {
  slug: string;
  title: string;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  key_takeaways_json: SerializableJson;
  faq_json: SerializableJson;
  schema_json: SerializableJson;
  content: string | null;
}

export interface CompareRoutePage {
  slug: string;
  title: string;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  entity_a: string;
  entity_b: string;
  pros_cons_json: SerializableJson;
  faq_json: SerializableJson;
  schema_json: SerializableJson;
  content: string | null;
}

export interface SearchIntentMeta {
  title?: string;
  meta_title?: string;
  meta_description?: string;
  summary?: string;
  content?: string;
  faq_schema?: SerializableJson;
}

export interface SearchIntentGeoBlocks {
  tldr?: string;
  quick_answer?: string;
  key_facts?: string[];
  why_it_matters?: string;
  expert_summary?: string;
  faq?: { q: string; a: string }[];
  related_questions?: string[];
  sources?: { title?: string; url: string; publisher?: string }[];
}

export interface SearchIntentRouteIntent {
  id: string;
  keyword: string;
  target_slug: string;
  content_status: string;
  intent_type: string;
  is_pillar: boolean;
  pillar_intent_id: string | null;
  meta: SearchIntentMeta | null;
  geo_blocks: SearchIntentGeoBlocks | null;
  search_cluster?: string | null;
  entity_id?: string | null;
  secondary_entity_id?: string | null;
}

export interface SearchIntentRoutePillar {
  keyword: string;
  target_slug: string;
  content_status: string;
}

export async function loadGuideRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<GuideRoutePage>> {
  if (!slug) return routeNotFound();
  const { data, error } = await client.from("guides").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? routeFound(data as unknown as GuideRoutePage) : routeNotFound();
}

export async function loadKnowledgeRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<KnowledgeRoutePage>> {
  if (!slug) return routeNotFound();
  const { data, error } = await client.from("knowledge_pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? routeFound(data as unknown as KnowledgeRoutePage) : routeNotFound();
}

export async function loadCompareRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<CompareRoutePage>> {
  if (!slug) return routeNotFound();
  const { data, error } = await client.from("comparison_pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? routeFound(data as unknown as CompareRoutePage) : routeNotFound();
}



export async function loadClusterRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<ClusterRouteData>> {
  const cluster = slug ? getCluster(slug) : undefined;
  if (!cluster) return routeNotFound();

  const [definitionResult, seedsResult] = await Promise.all([
    client
      .from("cluster_definitions")
      .select("guide_categories")
      .eq("slug", cluster.slug)
      .maybeSingle(),
    client
      .from("cluster_seed_nodes")
      .select("node_type, node_id")
      .eq("cluster_slug", cluster.slug)
      .limit(2000),
  ]);

  if (definitionResult.error) throw definitionResult.error;
  if (seedsResult.error) throw seedsResult.error;

  const guideCategories = definitionResult.data?.guide_categories || [];
  const seeds = seedsResult.data || [];
  const seedEntityIds = seeds
    .filter((seed) => seed.node_type === "entity")
    .map((seed) => seed.node_id);
  const seedTopicIds = seeds
    .filter((seed) => seed.node_type === "topic")
    .map((seed) => seed.node_id);

  const articlesPromise = client
    .from("articles")
    .select("*, article_clusters!inner(cluster_slug)")
    .eq("article_clusters.cluster_slug", cluster.slug)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(8);

  const topicsPromise = seedTopicIds.length
    ? client
        .from("topics")
        .select("id, name, slug, authority_score, trending_score, article_count")
        .in("id", seedTopicIds.slice(0, 120))
        .order("article_count", { ascending: false })
        .limit(8)
    : Promise.resolve({ data: [], error: null });

  const entitiesPromise = seedEntityIds.length
    ? client
        .from("entities")
        .select("id, name, slug, authority_score, mention_count")
        .in("id", seedEntityIds.slice(0, 120))
        .order("mention_count", { ascending: false })
        .limit(8)
    : Promise.resolve({ data: [], error: null });

  const guidesPromise = guideCategories.length
    ? client
        .from("guides")
        .select("slug, title, summary")
        .eq("published", true)
        .in("category", guideCategories)
        .limit(6)
    : Promise.resolve({ data: [], error: null });

  const [articlesResult, topicsResult, entitiesResult, guidesResult, knowledgeResult, comparisonsResult, statsResult] =
    await Promise.all([
      articlesPromise,
      topicsPromise,
      entitiesPromise,
      guidesPromise,
      client
        .from("knowledge_pages")
        .select("slug, title, summary, topic_id, entity_id")
        .eq("published", true)
        .limit(200),
      client
        .from("comparison_pages")
        .select("slug, title, summary, entity_a_id, entity_b_id")
        .eq("published", true)
        .limit(200),
      client.from("cluster_stats").select("*").eq("slug", cluster.slug).maybeSingle(),
    ]);

  for (const result of [
    articlesResult,
    topicsResult,
    entitiesResult,
    guidesResult,
    knowledgeResult,
    comparisonsResult,
    statsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const entityIds = new Set(seedEntityIds);
  const topicIds = new Set(seedTopicIds);

  const knowledge = ((knowledgeResult.data || []) as ClusterRouteKnowledge[])
    .filter((item) => topicIds.has(item.topic_id || "") || entityIds.has(item.entity_id || ""))
    .slice(0, 6);

  const comparisons = ((comparisonsResult.data || []) as ClusterRouteComparison[])
    .filter((item) => entityIds.has(item.entity_a_id || "") || entityIds.has(item.entity_b_id || ""))
    .slice(0, 6);

  return routeFound({
    cluster,
    stats: (statsResult.data || null) as ClusterStatsRow | null,
    articles: (articlesResult.data || []) as unknown as ClusterRouteArticle[],
    topics: (topicsResult.data || []) as ClusterRouteTopic[],
    entities: (entitiesResult.data || []) as ClusterRouteEntity[],
    guides: (guidesResult.data || []) as ClusterRouteGuide[],
    knowledge,
    comparisons,
  });
}
export async function loadSearchIntentRouteData(
  client: MarketrendsDataClient,
  slug?: string,
): Promise<RouteResolution<{ intent: SearchIntentRouteIntent; pillar: SearchIntentRoutePillar | null }>> {
  if (!slug) return routeNotFound();

  const { data, error } = await client
    .from("search_intents")
    .select("*")
    .eq("target_slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.content_status !== "published") return routeNotFound();

  const intent = data as unknown as SearchIntentRouteIntent;
  let pillar: SearchIntentRoutePillar | null = null;

  if (!intent.is_pillar && intent.pillar_intent_id) {
    const { data: pillarData, error: pillarError } = await client
      .from("search_intents")
      .select("keyword, target_slug, content_status")
      .eq("id", intent.pillar_intent_id)
      .maybeSingle();

    if (pillarError) throw pillarError;
    if (pillarData?.content_status === "published") {
      pillar = pillarData as SearchIntentRoutePillar;
    }
  }

  return routeFound({ intent, pillar });
}
