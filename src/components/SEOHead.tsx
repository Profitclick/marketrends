import { Helmet } from "react-helmet";
import { generateBreadcrumbSchema } from "@/utils/seo";

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  ogType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
  breadcrumbs?: { name: string; url: string }[];
  articleSchema?: object;
  faqSchema?: object;
  noIndex?: boolean;
}

// Use the actual published domain
const SITE_URL = "https://marketrends.no";
const SITE_NAME = "Marketrends.no";

export const SEOHead = ({
  title,
  description,
  canonicalUrl,
  ogImage = "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/697c7e75-8636-4eeb-a190-4d486aaace10",
  ogType = "website",
  publishedTime,
  modifiedTime,
  author,
  section,
  tags,
  breadcrumbs,
  articleSchema,
  faqSchema,
  noIndex = false
}: SEOHeadProps) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const truncatedDescription = description.substring(0, 160);

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={truncatedDescription} />
      <meta name="author" content={author || SITE_NAME} />
      
      {/* Robots */}
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}
      <meta name="googlebot" content="index, follow" />
      <meta name="googlebot-news" content="index, follow" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Language and Geo Tags */}
      <meta name="language" content="Norwegian Bokmål" />
      <meta httpEquiv="content-language" content="nb-NO" />
      <meta name="geo.region" content="NO" />
      <meta name="geo.placename" content="Oslo" />
      <meta name="geo.position" content="59.9139;10.7522" />
      <meta name="ICBM" content="59.9139, 10.7522" />
      
      {/* Hreflang for Norwegian variants */}
      <link rel="alternate" hrefLang="nb" href={canonicalUrl} />
      <link rel="alternate" hrefLang="no" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:locale" content="nb_NO" />
      <meta property="og:site_name" content={SITE_NAME} />
      
      {/* Article specific OG tags */}
      {ogType === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {ogType === "article" && publishedTime && (
        <meta property="article:modified_time" content={modifiedTime || publishedTime} />
      )}
      {ogType === "article" && author && (
        <meta property="article:author" content={author} />
      )}
      {ogType === "article" && section && (
        <meta property="article:section" content={section} />
      )}
      {ogType === "article" && tags?.map((tag, i) => (
        <meta key={i} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={truncatedDescription} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:site" content="@marketrends_no" />
      
      {/* Google News specific */}
      <meta name="news_keywords" content={tags?.join(", ") || "fintech, krypto, AI, trading, investering, norsk økonomi"} />
      
      {/* Publisher */}
      <link rel="publisher" href={SITE_URL} />
      
      {/* Sitewide Organization and WebSite schemas live once in index.html. */}
      
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(generateBreadcrumbSchema(breadcrumbs))}
        </script>
      )}
      
      {articleSchema && (
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
      )}

      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
    </Helmet>
  );
};
