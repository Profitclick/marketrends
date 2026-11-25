import { ArticleContent } from "@/components/ArticleContent";
import type {
  CategoryRouteData,
  ClusterRouteData,
  CompareRoutePage,
  EntityRouteData,
  GuideRoutePage,
  KnowledgeRoutePage,
  NewsRouteData,
  SearchIntentRouteIntent,
  SearchIntentRoutePillar,
  TopicRouteData,
} from "@/lib/routeData";

const Shell = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string | null;
  children?: React.ReactNode;
}) => (
  <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-5">
        <a href="/" className="font-serif text-2xl font-bold">
          Marketrends.no
        </a>
      </div>
    </header>
    <main className="mx-auto max-w-[1200px] px-4 py-10">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mb-5 text-4xl font-bold md:text-5xl">{title}</h1>
        {description && (
          <p className="mb-8 text-lg leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </main>
  </div>
);

const ArticleLinks = ({
  articles,
}: {
  articles: Array<{ id?: string; slug: string; title: string; meta_description?: string | null }>;
}) => (
  <div className="grid gap-5 md:grid-cols-2">
    {articles.map((article) => (
      <article key={article.id || article.slug} className="border-t border-border pt-4">
        <h2 className="text-xl font-semibold">
          <a href={`/${article.slug}`} className="hover:underline">
            {article.title}
          </a>
        </h2>
        {article.meta_description && (
          <p className="mt-2 text-sm text-muted-foreground">{article.meta_description}</p>
        )}
      </article>
    ))}
  </div>
);

export function HomepageRouteShell({ data }: { data: NewsRouteData }) {
  return (
    <Shell
      eyebrow="Norsk finans, fintech og teknologi"
      title="Norsk Fintech, Krypto & Markedsnyheter"
      description="Siste nyheter og analyser fra Marketrends.no."
    >
      <ArticleLinks articles={data.articles.slice(0, 24)} />
    </Shell>
  );
}

export function ArticleRouteShell({ data }: { data: NewsRouteData }) {
  const article = data.selectedArticle;
  if (!article) return null;
  return (
    <Shell eyebrow={article.category} title={article.title} description={article.meta_description}>
      <article className="max-w-3xl">
        <ArticleContent content={article.content} />
        <p className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">
          Kilde:{" "}
          <a href={article.source_url} rel="nofollow noopener" className="underline">
            {article.source_name}
          </a>
        </p>
      </article>
    </Shell>
  );
}

export function CategoryRouteShell({ data }: { data: CategoryRouteData }) {
  return (
    <Shell eyebrow="Kategori" title={data.category.name} description={data.category.description}>
      <ArticleLinks articles={data.articles} />
    </Shell>
  );
}

export function TopicRouteShell({ data }: { data: TopicRouteData }) {
  return (
    <Shell
      eyebrow="Tema"
      title={data.topic.name}
      description={data.topic.meta_description || data.topic.description}
    >
      <ArticleLinks articles={data.articles.slice(0, 24)} />
    </Shell>
  );
}

export function EntityRouteShell({ data }: { data: EntityRouteData }) {
  const entity = data.entity;
  const facts = Array.isArray(entity.key_facts)
    ? entity.key_facts.filter((item): item is string => typeof item === "string")
    : [];
  return (
    <Shell
      eyebrow="Aktør"
      title={entity.name}
      description={entity.meta_description || entity.summary || entity.description}
    >
      {facts.length > 0 && (
        <ul className="max-w-3xl list-disc space-y-2 pl-5">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function GuideRouteShell({ page }: { page: GuideRoutePage }) {
  return (
    <Shell eyebrow="Guide" title={page.title} description={page.summary || page.meta_description}>
      {page.content && <div className="max-w-3xl"><ArticleContent content={page.content} /></div>}
    </Shell>
  );
}

export function KnowledgeRouteShell({ page }: { page: KnowledgeRoutePage }) {
  return (
    <Shell
      eyebrow="Kunnskap"
      title={page.title}
      description={page.summary || page.meta_description}
    >
      {page.content && <div className="max-w-3xl"><ArticleContent content={page.content} /></div>}
    </Shell>
  );
}

export function CompareRouteShell({ page }: { page: CompareRoutePage }) {
  return (
    <Shell
      eyebrow="Sammenligning"
      title={page.title}
      description={page.summary || page.meta_description}
    >
      <p className="mb-8 text-lg font-semibold">
        {page.entity_a} vs. {page.entity_b}
      </p>
      {page.content && <div className="max-w-3xl"><ArticleContent content={page.content} /></div>}
    </Shell>
  );
}

export function IntentRouteShell({
  intent,
  pillar,
}: {
  intent: SearchIntentRouteIntent;
  pillar: SearchIntentRoutePillar | null;
}) {
  const meta = intent.meta || {};
  return (
    <Shell
      eyebrow={intent.is_pillar ? "Pilar" : intent.intent_type}
      title={meta.title || intent.keyword}
      description={meta.meta_description || meta.summary}
    >
      {pillar && (
        <p className="mb-5 text-sm text-muted-foreground">
          Pilar: <a className="underline" href={`/intent/${pillar.target_slug}`}>{pillar.keyword}</a>
        </p>
      )}
      {meta.content && <div className="max-w-3xl"><ArticleContent content={meta.content} /></div>}
    </Shell>
  );
}

export function ClusterRouteShell({ data }: { data: ClusterRouteData }) {
  return (
    <Shell eyebrow="Cluster" title={data.cluster.name} description={data.cluster.intro}>
      <ArticleLinks articles={data.articles} />
      {data.topics.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold">Temaer</h2>
          <div className="flex flex-wrap gap-3">
            {data.topics.map((topic) => (
              <a key={topic.id} href={`/topic/${topic.slug}`} className="underline">
                {topic.name}
              </a>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
