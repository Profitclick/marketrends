import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { routeFound, routeNotFound, type RouteResolution } from "@/lib/routeResolution";

export type MarketrendsDataClient = SupabaseClient<Database>;

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
  key_facts: unknown;
  faqs: unknown;
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
  steps_json: unknown;
  faq_json: unknown;
  resources_json: unknown;
  content: string | null;
  [key: string]: unknown;
}

export interface KnowledgeRoutePage {
  slug: string;
  title: string;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  key_takeaways_json: unknown;
  faq_json: unknown;
  schema_json: object | null;
  content: string | null;
  [key: string]: unknown;
}

export interface CompareRoutePage {
  slug: string;
  title: string;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  entity_a: string;
  entity_b: string;
  pros_cons_json: unknown;
  faq_json: unknown;
  schema_json: object | null;
  content: string | null;
  [key: string]: unknown;
}

export interface SearchIntentMeta {
  title?: string;
  meta_title?: string;
  meta_description?: string;
  summary?: string;
  content?: string;
  faq_schema?: object;
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
  [key: string]: unknown;
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
