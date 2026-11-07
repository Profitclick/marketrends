import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { MarketTicker } from "@/components/MarketTicker";
import { HeroSection } from "@/components/HeroSection";
import { CategoryBlock } from "@/components/CategoryBlock";
import { QuickHeadlines } from "@/components/QuickHeadlines";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { NewsSidebar } from "@/components/NewsSidebar";
import { NewsFooter } from "@/components/NewsFooter";
import { Last24Hours } from "@/components/Last24Hours";
import { BreakingNewsBanner } from "@/components/BreakingNewsBanner";
import { ArticleDetailView } from "@/components/ArticleDetailView";
import { TrendingTopics } from "@/components/TrendingTopics";
import { TopicHubGrid } from "@/components/TopicHubGrid";
import { EditorsPicks } from "@/components/EditorsPicks";
import { MarketPulse } from "@/components/MarketPulse";
import { MostReadToday } from "@/components/MostReadToday";
import { MostReadThisWeek } from "@/components/MostReadThisWeek";
import { RecommendedForYou } from "@/components/RecommendedForYou";
import { SEOHead } from "@/components/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
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

const BASE_URL = "https://marketrends.no";

const ArticleSkeleton = () => (
  <div className="max-w-[1200px] mx-auto px-4 py-10">
    <div className="max-w-3xl">
      <Skeleton className="h-5 w-24 mb-6" />
      <Skeleton className="h-12 w-full mb-4" />
      <Skeleton className="h-6 w-3/4 mb-8" />
      <Skeleton className="aspect-video w-full mb-8" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  </div>
);

const HomepageSkeleton = () => (
  <div className="max-w-[1200px] mx-auto px-4 py-8">
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7">
        <Skeleton className="aspect-[16/10] w-full" />
      </div>
      <div className="lg:col-span-5 space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  </div>
);

const NewsView = () => {
  const { slug } = useParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArticles = async () => {
    try {
      if (slug) {
        const { data: articleData, error: articleError } = await supabase
          .from("articles")
          .select(`*, affiliate_partners(name)`)
          .eq("published", true)
          .eq("slug", slug)
          .maybeSingle();

        if (articleError) throw articleError;
        if (articleData) {
          setSelectedArticle({
            ...articleData,
            archived_sources: articleData.archived_sources as string[] | null,
          });
        }
      }

      const { data, error } = await supabase
        .from("articles")
        .select(
          `id, title, slug, source_name, source_url, category, tags, meta_description, image_url, created_at, published, is_affiliate, risk_warning, article_type, affiliate_partners(name)`
        )
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const fetchedArticles = (data || []).map((article) => ({
        ...article,
        content: "",
        archived_sources: null as string[] | null,
      }));
      setArticles(fetchedArticles);
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [slug]);

  useEffect(() => {
    const channel = supabase
      .channel("articles-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "articles", filter: "published=eq.true" }, (payload) => {
        const newArticle = { ...payload.new, archived_sources: payload.new.archived_sources as string[] | null, affiliate_partners: null } as Article;
        setArticles((prev) => [newArticle, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "articles" }, (payload) => {
        const updatedArticle = { ...payload.new, archived_sources: payload.new.archived_sources as string[] | null, affiliate_partners: null } as Article;
        if (updatedArticle.published) {
          setArticles((prev) => {
            const exists = prev.some((a) => a.id === updatedArticle.id);
            if (exists) return prev.map((a) => (a.id === updatedArticle.id ? updatedArticle : a));
            return [updatedArticle, ...prev];
          });
        } else {
          setArticles((prev) => prev.filter((a) => a.id !== updatedArticle.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const articlesByCategory = articles.reduce((acc, article) => {
    if (!acc[article.category]) acc[article.category] = [];
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, Article[]>);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <MarketTicker />
        <Navigation />
        {slug ? <ArticleSkeleton /> : <HomepageSkeleton />}
        <NewsFooter />
      </div>
    );
  }

  if (selectedArticle) {
    return <ArticleDetailView article={selectedArticle} allArticles={articles} />;
  }

  const categories = [
    { name: "Krypto & Trading", slug: "krypto-trading" },
    { name: "Teknologi & AI", slug: "teknologi-ai" },
    { name: "Finans & Marked", slug: "finans-marked" },
    { name: "Gründer & Startups", slug: "grunder-startups" },
    { name: "Penger & Karriere", slug: "penger-karriere" },
    { name: "Trender & Analyse", slug: "trender-analyse" },
    { name: "Guider & Forklart", slug: "guider-forklart" },
  ];

  const allTags = Array.from(new Set(articles.flatMap((a) => a.tags || [])));

  // Deduplication
  const heroArticles = articles.slice(0, 4);
  const shownIds = new Set(heroArticles.map((a) => a.id));

  const headlineArticles = articles.filter((a) => !shownIds.has(a.id)).slice(0, 6);
  headlineArticles.forEach((a) => shownIds.add(a.id));

  const getCategoryArticles = (catName: string, count: number) => {
    const catArticles = (articlesByCategory[catName] || []).filter((a) => !shownIds.has(a.id));
    const result = catArticles.slice(0, count); // never fill with other categories
    result.forEach((a) => shownIds.add(a.id));
    return result;
  };

  const sidebarArticles = articles.filter((a) => !shownIds.has(a.id)).slice(0, 10);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <a href="#main-content" className="skip-link">Hopp til hovedinnhold</a>
      <SEOHead
        title="Norsk Fintech, Krypto & Markedsnyheter"
        description="Norges ledende kilde for markedstrender, fintech, krypto, AI og startup-nyheter. Oppdatert døgnet rundt med de siste nyhetene innen teknologi og finans."
        canonicalUrl={BASE_URL}
        ogType="website"
      />

      <MarketTicker />
      <Navigation />
      <LatestNewsTicker articles={articles.slice(0, 10)} />

      <main id="main-content" className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-6 md:py-10 flex-1">
        <BreakingNewsBanner />
        <HeroSection articles={heroArticles} />
        <MarketPulse />
        <TrendingTopics />
        <QuickHeadlines articles={headlineArticles} />

        {/* Main + Sidebar */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8 space-y-12 md:space-y-16 min-w-0">
            {categories.slice(0, 3).map((cat) => (
              <CategoryBlock key={cat.name} category={cat.name} categorySlug={cat.slug} articles={getCategoryArticles(cat.name, 4)} />
            ))}

            <RecommendedForYou limit={4} />
            <TopicHubGrid limit={6} title="Trending temaer" />
            <EditorsPicks limit={4} />

            <div className="grid md:grid-cols-2 gap-8 md:gap-10">
              <MostReadToday limit={6} />
              <MostReadThisWeek limit={6} />
            </div>

            <Last24Hours articles={articles} />

            {categories.slice(3).map((cat) => (
              <CategoryBlock key={cat.name} category={cat.name} categorySlug={cat.slug} articles={getCategoryArticles(cat.name, 4)} />
            ))}

            <TopicHubGrid
              limit={6}
              title="AI & Krypto trender"
              categoryHints={["Krypto & Trading", "Teknologi & AI"]}
            />
          </div>

          <aside className="lg:col-span-4 min-w-0">
            <div className="lg:sticky lg:top-24 space-y-8">
              <NewsSidebar popularArticles={sidebarArticles} allTags={allTags} />
            </div>
          </aside>
        </div>
      </main>

      <NewsFooter />
    </div>
  );
};

export default NewsView;
