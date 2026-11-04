import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { NewsFooter } from "@/components/NewsFooter";
import { AuthorByline } from "@/components/AuthorByline";
import { AffiliateDisclaimer } from "@/components/AffiliateDisclaimer";
import { RelatedArticles } from "@/components/RelatedArticles";
import { SemanticRelatedArticles } from "@/components/SemanticRelatedArticles";
import { TopicChips } from "@/components/TopicChips";
import { EntityChips } from "@/components/EntityChips";
import { MoreAboutTopic } from "@/components/MoreAboutTopic";
import { ArticleContent } from "@/components/ArticleContent";
import { KeyTakeaways } from "@/components/KeyTakeaways";
import { ContinueReading } from "@/components/ContinueReading";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { ReadingProgress } from "@/components/ReadingProgress";
import { RecommendedForYou } from "@/components/RecommendedForYou";
import { ContextualLinks } from "@/components/ContextualLinks";
import { SourcesPanel } from "@/components/SourcesPanel";
import { SEOHead } from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Home, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { getRandomAuthor, getEditorInChief, calculateReadingTime } from "@/utils/authors";
import { generateArticleSchema, getCategoryFallbackImage } from "@/utils/seo";
import { logRead } from "@/lib/readingHistory";

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

interface ArticleDetailViewProps {
  article: Article;
  allArticles: Article[];
}

export const ArticleDetailView = ({ article, allArticles }: ArticleDetailViewProps) => {
  const author = getRandomAuthor();
  const editor = getEditorInChief();
  const readingTime = calculateReadingTime(article.content);
  const articleIndex = allArticles.findIndex((a) => a.id === article.id);
  const articleImage = article.image_url || getCategoryFallbackImage(article.category, articleIndex);
  const canonicalUrl = `${BASE_URL}/${article.slug}`;
  const wordCount = article.content.split(/\s+/).filter((w) => w.length > 0).length;

  useEffect(() => {
    logRead({
      slug: article.slug,
      id: article.id,
      category: article.category,
      title: article.title,
    });
  }, [article.id, article.slug, article.category, article.title]);

  const articleSchema = generateArticleSchema({
    title: article.title,
    description: article.meta_description || article.title,
    image: articleImage,
    url: canonicalUrl,
    author: author.name,
    publishedTime: article.created_at,
    modifiedTime: article.created_at,
    category: article.category,
    tags: article.tags,
    wordCount,
  });

  const relatedArticles = allArticles
    .filter((a) => a.id !== article.id && a.category === article.category)
    .slice(0, 3)
    .map((a) => ({ slug: a.slug, title: a.title, category: a.category }));

  const breadcrumbs = [
    { name: "Hjem", url: BASE_URL },
    { name: article.category, url: `${BASE_URL}/?kategori=${article.category.toLowerCase().replace(/\s+/g, "-")}` },
    { name: article.title.substring(0, 50), url: canonicalUrl },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <ReadingProgress />
      <SEOHead
        title={article.title}
        description={article.meta_description || article.title}
        canonicalUrl={canonicalUrl}
        ogImage={articleImage}
        ogType="article"
        publishedTime={article.created_at}
        author={author.name}
        section={article.category}
        tags={article.tags}
        breadcrumbs={breadcrumbs}
        articleSchema={articleSchema}
      />

      <MarketTicker />
      <Navigation />
      <LatestNewsTicker articles={allArticles.slice(0, 10)} />

      <main className="max-w-[1200px] mx-auto px-4 py-10 md:py-16">
        <div className="max-w-3xl">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-[12px] text-muted-foreground mb-8" style={{ fontFamily: "'Inter', sans-serif" }}>
            <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              Hjem
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/?kategori=${article.category.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-foreground transition-colors">
              {article.category}
            </Link>
          </nav>

          <article>
            <header className="mb-8">
              <span
                className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-3 block"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {article.category}
                {article.article_type && article.article_type !== "news" && (
                  <span className="text-muted-foreground font-medium ml-2">· {article.article_type}</span>
                )}
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 leading-[1.1] tracking-tight text-balance">
                {article.title}
              </h1>
              {article.meta_description && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                  {article.meta_description}
                </p>
              )}
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <FreshnessBadge date={article.created_at} />
                <TopicChips articleId={article.id} />
                <EntityChips articleId={article.id} />
              </div>
            </header>

            <AuthorByline
              author={author}
              date={format(new Date(article.created_at), "d. MMMM yyyy, HH:mm", { locale: nb })}
              readingTime={readingTime}
              category={article.category}
            />

            {articleImage && (
              <figure className="my-10">
                <img src={articleImage} alt={article.title} className="w-full h-auto" loading="lazy" />
                <figcaption className="text-[11px] text-muted-foreground mt-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Illustrasjonsbilde | Marketrends
                </figcaption>
              </figure>
            )}

            {article.is_affiliate && (
              <AffiliateDisclaimer partnerName={article.affiliate_partners?.name} riskWarning={article.risk_warning} />
            )}

            <KeyTakeaways
              content={article.content}
              metaDescription={article.meta_description}
              title={article.title}
            />

            <div className="my-10">
              <ArticleContent content={article.content} relatedArticles={relatedArticles} />
            </div>

            <ContinueReading articleId={article.id} category={article.category} />

            {article.tags && article.tags.length > 0 && (
              <div className="mb-8 pt-6 border-t border-border">
                <h3
                  className="font-semibold mb-3 text-[11px] uppercase tracking-widest text-muted-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Relaterte temaer
                </h3>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-[11px] rounded-none font-medium">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {article.archived_sources && article.archived_sources.length > 0 && (
              <div className="mb-8 pt-6 border-t border-border">
                <h3
                  className="font-semibold mb-3 text-[11px] uppercase tracking-widest text-muted-foreground"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Kilder
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  {article.archived_sources.map((source, idx) => (
                    <li key={idx}>
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground hover:underline inline-flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-[400px]">{source}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-border pt-6 mb-8">
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline font-medium transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Les originalartikkelen hos {article.source_name}
              </a>
            </div>

            <div className="border-t border-border pt-6 text-sm text-muted-foreground">
              <p>
                Redigert av <strong className="text-foreground">{editor.name}</strong> – {editor.role}
              </p>
            </div>

            <div className="border-t-2 border-foreground pt-6 mt-8 mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
                Utforsk tema
              </h3>
              <TopicChips articleId={article.id} />
            </div>

            <MoreAboutTopic articleId={article.id} />

            <SemanticRelatedArticles articleId={article.id} variant="footer" />
            <RelatedArticles
              currentArticle={{ id: article.id, category: article.category, tags: article.tags || [] }}
              allArticles={allArticles}
              variant="footer"
            />
            <SourcesPanel articleId={article.id} />
            <ContextualLinks sourceType="article" sourceSlug={article.slug} title="Mer på Marketrends" />
          </article>

          <RecommendedForYou limit={4} excludeId={article.id} />
        </div>
      </main>


      <NewsFooter />
    </div>
  );
};
