import { generateArticleSchema, getCategoryFallbackImage } from "@/utils/seo";
import type { Author } from "@/utils/authors";
import type { ClusterConfig } from "@/config/clusters";
import type {
  CategoryDefinition,
  EntityRouteEntity,
  TopicRouteArticle,
  TopicRouteEntity,
  TopicRouteTopic,
  GuideRoutePage,
  KnowledgeRoutePage,
  CompareRoutePage,
  SearchIntentRouteIntent,
  SearchIntentRoutePillar,
  RouteArticle,
  type SerializableJson,
} from "@/lib/routeData";

export const SITE_URL = "https://marketrends.no";

function schemaObject(value: SerializableJson | undefined): object | undefined {
  return value !== null && value !== undefined && typeof value === "object"
    ? (value as object)
    : undefined;
}

export interface RouteSeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  ogType?: "website" | "article";
  tags?: string[];
  breadcrumbs?: { name: string; url: string }[];
  articleSchema?: object;
  faqSchema?: object;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
}

export function homepageMetadata(): RouteSeoMetadata {
  return {
    title: "Norsk Fintech, Krypto & Markedsnyheter",
    description: "Norges ledende kilde for markedstrender, fintech, krypto, AI og startup-nyheter. Oppdatert døgnet rundt med de siste nyhetene innen teknologi og finans.",
    canonicalUrl: SITE_URL,
    ogType: "website",
  };
}


export function articleMetadata(
  article: RouteArticle,
  author: Author,
  articleIndex = 0,
): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/${article.slug}`;
  const image = article.image_url || getCategoryFallbackImage(article.category, articleIndex);
  const description = article.meta_description || article.title;
  const wordCount = article.content.split(/\s+/).filter((word) => word.length > 0).length;

  return {
    title: article.title,
    description,
    canonicalUrl,
    ogImage: image,
    ogType: "article",
    publishedTime: article.created_at,
    modifiedTime: article.updated_at || article.created_at,
    author: author.name,
    section: article.category,
    tags: article.tags || [],
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      {
        name: article.category,
        url: `${SITE_URL}/?kategori=${article.category.toLowerCase().replace(/\s+/g, "-")}`,
      },
      { name: article.title.substring(0, 50), url: canonicalUrl },
    ],
    articleSchema: generateArticleSchema({
      title: article.title,
      description,
      image,
      url: canonicalUrl,
      author: author.name,
      publishedTime: article.created_at,
      modifiedTime: article.updated_at || article.created_at,
      category: article.category,
      tags: article.tags || [],
      wordCount,
    }),
  };
}

export function clusterMetadata(cluster: ClusterConfig): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}${cluster.vertical || `/${cluster.slug}`}`;
  return {
    title: `${cluster.name} – tema, analyse og guider | Marketrends`,
    description: cluster.intro,
    canonicalUrl,
    ogType: "website",
    articleSchema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: cluster.name,
      description: cluster.intro,
      url: canonicalUrl,
    },
    faqSchema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: cluster.faq.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  };
}

export function categoryMetadata(slug: string, category: CategoryDefinition): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/kategori/${slug}`;
  return {
    title: `${category.name} - Norsk nyhetsportal`,
    description: category.description,
    canonicalUrl,
    ogType: "website",
    tags: category.keywords.split(", "),
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: category.name, url: canonicalUrl },
    ],
  };
}

export function topicMetadata(
  topic: TopicRouteTopic,
  articles: TopicRouteArticle[],
  hero: TopicRouteArticle | null,
  entities: TopicRouteEntity[],
): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/topic/${topic.slug}`;
  const description = topic.meta_description || topic.description || `Følg ${topic.name} på Marketrends.no.`;
  return {
    title: topic.meta_title || `${topic.name} – nyheter og analyse`,
    description,
    canonicalUrl,
    ogType: "website",
    ogImage: topic.og_image || hero?.image_url || (hero ? getCategoryFallbackImage(hero.category, 0) : undefined),
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: "Tema", url: `${SITE_URL}/` },
      { name: topic.name, url: canonicalUrl },
    ],
    articleSchema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: topic.name,
      description: topic.description || topic.meta_description || `Nyheter og analyse om ${topic.name}`,
      url: canonicalUrl,
      inLanguage: "nb-NO",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: articles.length,
        itemListElement: articles.slice(0, 20).map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}/${article.slug}`,
          name: article.title,
        })),
      },
    },
    tags: entities.slice(0, 5).map((entity) => entity.name),
  };
}

const schemaType: Record<string, string> = {
  person: "Person",
  company: "Organization",
  organization: "Organization",
  government: "GovernmentOrganization",
  product: "Product",
  location: "Place",
  technology: "Thing",
  cryptocurrency: "Thing",
  asset: "Thing",
};

export function entityMetadata(entity: EntityRouteEntity): {
  seo: RouteSeoMetadata;
  entitySchema: object;
  facts: string[];
  faqs: { q: string; a: string }[];
} {
  const canonicalUrl = `${SITE_URL}/entity/${entity.slug}`;
  const description =
    entity.meta_description ||
    entity.summary ||
    entity.description ||
    `Følg ${entity.name} på Marketrends. Nyheter, analyse og redaksjonell kontekst om ${entity.name}.`;
  const facts = Array.isArray(entity.key_facts) ? entity.key_facts.filter((x): x is string => typeof x === "string") : [];
  const isFaq = (value: unknown): value is { q: string; a: string } => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return typeof record.q === "string" && typeof record.a === "string";
  };
  const faqs = Array.isArray(entity.faqs) ? entity.faqs.filter(isFaq) : [];

  return {
    seo: {
      title: entity.meta_title || `${entity.name} – Nyheter, analyse og kontekst`,
      description,
      canonicalUrl,
      ogImage: entity.og_image || undefined,
      ogType: "website",
      breadcrumbs: [
        { name: "Forsiden", url: SITE_URL },
        { name: "Aktører", url: `${SITE_URL}/entity` },
        { name: entity.name, url: canonicalUrl },
      ],
      faqSchema: faqs.length
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }
        : undefined,
    },
    entitySchema: {
      "@context": "https://schema.org",
      "@type": schemaType[entity.type] || "Thing",
      name: entity.name,
      alternateName: entity.aliases || [],
      description,
      url: canonicalUrl,
      ...(entity.wikidata_id && { sameAs: [`https://www.wikidata.org/wiki/${entity.wikidata_id}`] }),
      ...(entity.og_image && { image: entity.og_image }),
    },
    facts,
    faqs,
  };
}


export function guideMetadata(page: GuideRoutePage): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/guide/${page.slug}`;
  const steps = Array.isArray(page.steps_json) ? page.steps_json as { title: string; description: string }[] : [];
  return {
    title: page.meta_title || page.title,
    description: page.meta_description || page.summary || page.title,
    canonicalUrl,
    ogType: "article",
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: "Guider", url: `${SITE_URL}/guide` },
      { name: page.title, url: canonicalUrl },
    ],
    articleSchema: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: page.title,
      description: page.summary || page.meta_description,
      step: steps.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.title,
        text: step.description,
      })),
    },
  };
}

export function knowledgeMetadata(page: KnowledgeRoutePage): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/knowledge/${page.slug}`;
  return {
    title: page.meta_title || page.title,
    description: page.meta_description || page.summary || page.title,
    canonicalUrl,
    ogType: "article",
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: "Kunnskap", url: `${SITE_URL}/knowledge` },
      { name: page.title, url: canonicalUrl },
    ],
    faqSchema: schemaObject(page.schema_json),
  };
}

export function compareMetadata(page: CompareRoutePage): RouteSeoMetadata {
  const canonicalUrl = `${SITE_URL}/compare/${page.slug}`;
  return {
    title: page.meta_title || page.title,
    description: page.meta_description || page.summary || page.title,
    canonicalUrl,
    ogType: "article",
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: "Sammenligninger", url: `${SITE_URL}/compare` },
      { name: page.title, url: canonicalUrl },
    ],
    faqSchema: page.schema_json || undefined,
  };
}

export const INTENT_LABEL: Record<string, string> = {
  informational: "Kunnskap",
  commercial: "Vurdering",
  transactional: "Guide",
  comparison: "Sammenligning",
};

export function searchIntentMetadata(
  intent: SearchIntentRouteIntent,
  pillar: SearchIntentRoutePillar | null,
): RouteSeoMetadata {
  const meta = intent.meta || {};
  const canonicalUrl = `${SITE_URL}/intent/${intent.target_slug}`;
  const title = meta.title || intent.keyword;
  return {
    title: meta.meta_title || title,
    description: meta.meta_description || meta.summary || title,
    canonicalUrl,
    ogType: "article",
    breadcrumbs: [
      { name: "Hjem", url: SITE_URL },
      { name: INTENT_LABEL[intent.intent_type] || "Intent", url: `${SITE_URL}/intent` },
      ...(pillar?.target_slug
        ? [{ name: pillar.keyword, url: `${SITE_URL}/intent/${pillar.target_slug}` }]
        : []),
      { name: title, url: canonicalUrl },
    ],
    faqSchema: schemaObject(meta.faq_schema),
  };
}
