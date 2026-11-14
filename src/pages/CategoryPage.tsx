import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { SEOHead } from "@/components/SEOHead";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleImage } from "@/components/ArticleImage";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";
import { resolveArticleImages } from "@/utils/articleImages";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Article {
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

const SITE_URL = "https://marketrends.no";

const CATEGORY_MAP: Record<string, { name: string; description: string; keywords: string }> = {
  "krypto-trading": {
    name: "Krypto & Trading",
    description: "Siste nytt om kryptovaluta, Bitcoin, Ethereum, trading og DeFi. Norske perspektiver på det globale kryptomarkedet.",
    keywords: "krypto, bitcoin, ethereum, trading, kryptovaluta, DeFi, blockchain"
  },
  "teknologi-ai": {
    name: "Teknologi & AI",
    description: "Nyheter om kunstig intelligens, teknologi, SaaS og digital transformasjon. AI-verktøy og tech-innovasjon.",
    keywords: "teknologi, AI, kunstig intelligens, SaaS, tech, software, innovasjon"
  },
  "finans-marked": {
    name: "Finans & Marked",
    description: "Fintech-nyheter, bankinnovasjon, investering og markedsanalyse. Oslo Børs og norsk økonomi.",
    keywords: "finans, fintech, bank, investering, Oslo Børs, marked, økonomi"
  },
  "grunder-startups": {
    name: "Gründer & Startups",
    description: "Inspirerende gründerhistorier, startup-nyheter og venture capital. Norsk innovasjon og entrepreneurskap.",
    keywords: "gründer, startup, venture, innovasjon, entreprenør, oppstart"
  },
  "penger-karriere": {
    name: "Penger & Karriere",
    description: "Personlig økonomi, karrieretips og jobbmarked. Slik tjener du mer og bygger din karriere.",
    keywords: "penger, karriere, lønn, jobb, personlig økonomi, sparing"
  },
  "trender-analyse": {
    name: "Trender & Analyse",
    description: "Dyptgående markedsanalyser, trender og data. Forstå hva som driver markedene.",
    keywords: "trender, analyse, marked, data, innsikt, research"
  },
  "guider-forklart": {
    name: "Guider & Forklart",
    description: "Praktiske guider og forklaringer. Lær hvordan du navigerer finans, krypto og tech.",
    keywords: "guide, hvordan, forklart, veiledning, tips, råd"
  }
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  const categoryInfo = slug ? CATEGORY_MAP[slug] : null;
  const categoryName = categoryInfo?.name || "Nyheter";
  const articleImages = useMemo(() => resolveArticleImages(articles), [articles]);

  useEffect(() => {
    const fetchArticles = async () => {
      if (!categoryInfo) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category, meta_description, image_url, created_at, article_type, tags")
        .eq("published", true)
        .eq("category", categoryInfo.name)
        .order("created_at", { ascending: false })
        .limit(24);

      if (!error && data && data.length > 0) {
        setArticles(data);
        setIsFallback(false);
      } else {
        const { data: fallbackData } = await supabase
          .from("articles")
          .select("id, title, slug, category, meta_description, image_url, created_at, article_type, tags")
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(24);

        if (fallbackData) {
          setArticles(fallbackData);
          setIsFallback(true);
        }
      }
      setLoading(false);
    };

    fetchArticles();
  }, [slug, categoryInfo]);

  const heroArticle = articles[0];
  const sideArticles = articles.slice(1, 5);
  const restArticles = articles.slice(5);
  const heroImage = heroArticle ? articleImages.get(heroArticle.id) : undefined;

  if (!categoryInfo) {
    return (
      <div className="min-h-dvh bg-background">
        <MarketTicker />
        <Navigation />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Kategori ikke funnet</h1>
          <Link to="/" className="text-primary hover:underline">Tilbake til forsiden</Link>
        </main>
        <NewsFooter />
      </div>
    );
  }

  const canonicalUrl = `${SITE_URL}/kategori/${slug}`;
  const breadcrumbs = [
    { name: "Hjem", url: SITE_URL },
    { name: categoryName, url: canonicalUrl }
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title={`${categoryName} - Norsk nyhetsportal`}
        description={categoryInfo.description}
        canonicalUrl={canonicalUrl}
        ogType="website"
        tags={categoryInfo.keywords.split(", ")}
        breadcrumbs={breadcrumbs}
      />

      <MarketTicker />
      <Navigation />
      <LatestNewsTicker articles={articles.slice(0, 10)} />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <nav aria-label="Brødsmuler" className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">Hjem</Link>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span className="text-foreground font-medium" aria-current="page">{categoryName}</span>
        </nav>

        <header className="mb-10 md:mb-12 pb-8 border-b-2 border-foreground">
          <p className="category-badge mb-3">Nyheter og analyse</p>
          <div className="grid lg:grid-cols-12 gap-4 lg:gap-8 lg:items-end">
            <h1 className="lg:col-span-7 text-4xl md:text-5xl text-foreground">{categoryName}</h1>
            <p className="lg:col-span-5 text-muted-foreground text-lg leading-8 max-w-2xl">{categoryInfo.description}</p>
          </div>
          {isFallback && (
            <p className="text-sm text-muted-foreground mt-4 italic">
              Viser siste nyheter på tvers av alle kategorier.
            </p>
          )}
        </header>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" aria-label="Laster artikler">
            <div className="lg:col-span-8">
              <Skeleton className="aspect-[16/9] w-full" />
            </div>
            <div className="lg:col-span-4 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 border-y border-border">
            <p className="text-muted-foreground text-lg">Ingen artikler funnet ennå.</p>
            <Link to="/" className="text-primary hover:underline mt-4 inline-block">
              Utforsk andre nyheter
            </Link>
          </div>
        ) : (
          <>
            <section aria-label="Siste saker" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-14 md:mb-16">
              {heroArticle && (
                <Link to={`/${heroArticle.slug}`} className="lg:col-span-8 group block">
                  <div className="relative aspect-[16/10] md:aspect-[16/9] overflow-hidden bg-muted">
                    <ArticleImage
                      src={heroImage?.src || heroArticle.image_url || getCategoryFallbackImage(heroArticle.category, 0)}
                      fallbackSrc={heroImage?.fallbackSrc || getCategoryFallbackImage(heroArticle.category, 1)}
                      alt={heroArticle.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      sizes="(min-width: 1200px) 760px, (min-width: 1024px) 66vw, 100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 md:p-8">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/80">{heroArticle.category}</span>
                      <h2 className="text-2xl md:text-4xl font-bold text-primary-foreground mt-2 mb-3 leading-tight line-clamp-3 group-hover:underline decoration-1 underline-offset-4">
                        {heroArticle.title}
                      </h2>
                      {heroArticle.meta_description && (
                        <p className="text-primary-foreground/85 text-sm md:text-base leading-6 line-clamp-2 max-w-2xl">{heroArticle.meta_description}</p>
                      )}
                      <time dateTime={heroArticle.created_at} className="text-[11px] text-primary-foreground/70 mt-3 block">
                        {format(new Date(heroArticle.created_at), "d. MMM yyyy", { locale: nb })}
                      </time>
                    </div>
                  </div>
                </Link>
              )}

              <aside className="lg:col-span-4 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6" aria-labelledby="latest-category-stories">
                <h2 id="latest-category-stories" className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-4">
                  Flere siste saker
                </h2>
                <div className="flex flex-col">
                  {sideArticles.map((article, i) => {
                    const image = articleImages.get(article.id);
                    return (
                      <Link key={article.id} to={`/${article.slug}`} className="group flex gap-4 py-3 first:pt-0 border-b border-border last:border-b-0">
                        <div className="flex-shrink-0 w-28 sm:w-32 lg:w-24 xl:w-28 aspect-[4/3] overflow-hidden bg-muted">
                          <ArticleImage
                            src={image?.src || article.image_url || getCategoryFallbackImage(article.category, i + 1)}
                            fallbackSrc={image?.fallbackSrc || getCategoryFallbackImage(article.category, i + 2)}
                            alt={article.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            loading="lazy"
                            decoding="async"
                            sizes="128px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{article.category}</span>
                          <h3 className="text-base font-bold leading-snug line-clamp-3 group-hover:underline decoration-1 underline-offset-4 mt-1">
                            {article.title}
                          </h3>
                          <time dateTime={article.created_at} className="text-[11px] text-muted-foreground mt-2 block">
                            {format(new Date(article.created_at), "d. MMM", { locale: nb })}
                          </time>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </aside>
            </section>

            {restArticles.length > 0 && (
              <section aria-labelledby="more-category-stories">
                <div className="flex items-end justify-between gap-4 border-t-2 border-foreground pt-4 mb-8">
                  <h2 id="more-category-stories" className="text-2xl md:text-3xl font-bold text-foreground">
                    Flere fra {categoryName}
                  </h2>
                  <span className="hidden sm:block text-xs font-sans uppercase tracking-wider text-muted-foreground pb-1">Utforsk arkivet</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
                  {restArticles.map((article, i) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      index={i + 5}
                      imageUrl={articleImages.get(article.id)?.src}
                      fallbackImageUrl={articleImages.get(article.id)?.fallbackSrc}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <NewsFooter />
    </div>
  );
}
