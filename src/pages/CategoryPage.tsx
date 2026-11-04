import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { SEOHead } from "@/components/SEOHead";
import { ArticleCard } from "@/components/ArticleCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { getCategoryFallbackImage } from "@/utils/seo";
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

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">Hjem</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{categoryName}</span>
        </nav>

        {/* Category Header */}
        <header className="mb-10 pb-6 border-b border-border">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">{categoryName}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">{categoryInfo.description}</p>
          {isFallback && (
            <p className="text-sm text-muted-foreground mt-2 italic">
              Viser siste nyheter på tvers av alle kategorier.
            </p>
          )}
        </header>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-[400px] w-full" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">Ingen artikler funnet ennå.</p>
            <Link to="/" className="text-primary hover:underline mt-4 inline-block">
              Utforsk andre nyheter
            </Link>
          </div>
        ) : (
          <>
            {/* Hero + Side articles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
              {heroArticle && (
                <Link to={`/${heroArticle.slug}`} className="lg:col-span-2 group block">
                  <div className="relative aspect-[16/10] overflow-hidden mb-3">
                    <img
                      src={heroArticle.image_url || getCategoryFallbackImage(heroArticle.category, 0)}
                      alt={heroArticle.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{heroArticle.category}</span>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mt-1 mb-2 leading-tight line-clamp-3 group-hover:underline decoration-1 underline-offset-2">
                        {heroArticle.title}
                      </h2>
                      {heroArticle.meta_description && (
                        <p className="text-white/80 text-sm line-clamp-2">{heroArticle.meta_description}</p>
                      )}
                      <time className="text-[11px] text-white/60 mt-2 block">
                        {format(new Date(heroArticle.created_at), "d. MMM yyyy", { locale: nb })}
                      </time>
                    </div>
                  </div>
                </Link>
              )}

              <div className="space-y-5">
                {sideArticles.map((article, i) => (
                  <Link key={article.id} to={`/${article.slug}`} className="group flex gap-4 pb-5 border-b border-border last:border-b-0">
                    <div className="flex-shrink-0 w-24 h-20 overflow-hidden">
                      <img
                        src={article.image_url || getCategoryFallbackImage(article.category, i + 1)}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{article.category}</span>
                      <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:underline decoration-1 underline-offset-2 mt-0.5">
                        {article.title}
                      </h3>
                      <time className="text-[10px] text-muted-foreground mt-1 block">
                        {format(new Date(article.created_at), "d. MMM", { locale: nb })}
                      </time>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Rest of articles grid */}
            {restArticles.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-foreground mb-6 pb-2 border-b border-border">
                  Flere fra {categoryName}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {restArticles.map((article, i) => (
                    <ArticleCard key={article.id} article={article} index={i + 5} />
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
