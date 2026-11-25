import { generateBreadcrumbSchema } from "@/utils/seo";
import type { RouteSeoMetadata } from "@/lib/routeMetadata";

const SITE_NAME = "Marketrends.no";
const SITE_URL = "https://marketrends.no";
const DEFAULT_OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/697c7e75-8636-4eeb-a190-4d486aaace10";

type HeadOptions = {
  noIndex?: boolean;
  extraSchemas?: object[];
};

export function toTanStackHead(
  seo: RouteSeoMetadata,
  { noIndex = false, extraSchemas = [] }: HeadOptions = {},
) {
  const fullTitle = seo.title.includes(SITE_NAME) ? seo.title : `${seo.title} | ${SITE_NAME}`;
  const description = seo.description.substring(0, 160);
  const image = seo.ogImage || DEFAULT_OG_IMAGE;
  const schemas = [
    ...(seo.breadcrumbs?.length ? [generateBreadcrumbSchema(seo.breadcrumbs)] : []),
    ...(seo.articleSchema ? [seo.articleSchema] : []),
    ...(seo.faqSchema ? [seo.faqSchema] : []),
    ...extraSchemas,
  ];

  return {
    meta: [
      { title: fullTitle },
      { name: "title", content: fullTitle },
      { name: "description", content: description },
      { name: "author", content: seo.author || SITE_NAME },
      {
        name: "robots",
        content: noIndex
          ? "noindex, nofollow"
          : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "googlebot", content: noIndex ? "noindex, nofollow" : "index, follow" },
      { name: "googlebot-news", content: noIndex ? "noindex, nofollow" : "index, follow" },
      { name: "language", content: "Norwegian Bokmål" },
      { name: "geo.region", content: "NO" },
      { name: "geo.placename", content: "Oslo" },
      { name: "geo.position", content: "59.9139;10.7522" },
      { name: "ICBM", content: "59.9139, 10.7522" },
      { property: "og:type", content: seo.ogType || "website" },
      { property: "og:url", content: seo.canonicalUrl },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: seo.title },
      { property: "og:locale", content: "nb_NO" },
      { property: "og:site_name", content: SITE_NAME },
      ...(seo.publishedTime
        ? [{ property: "article:published_time", content: seo.publishedTime }]
        : []),
      ...(seo.modifiedTime
        ? [{ property: "article:modified_time", content: seo.modifiedTime }]
        : []),
      ...(seo.author ? [{ property: "article:author", content: seo.author }] : []),
      ...(seo.section ? [{ property: "article:section", content: seo.section }] : []),
      ...(seo.tags || []).map((tag) => ({ property: "article:tag", content: tag })),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:url", content: seo.canonicalUrl },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:site", content: "@marketrends_no" },
      {
        name: "news_keywords",
        content:
          seo.tags?.join(", ") ||
          "fintech, krypto, AI, trading, investering, norsk økonomi",
      },
    ],
    links: noIndex
      ? []
      : [
          { rel: "canonical", href: seo.canonicalUrl },
          { rel: "alternate", hrefLang: "nb", href: seo.canonicalUrl },
          { rel: "alternate", hrefLang: "no", href: seo.canonicalUrl },
          { rel: "alternate", hrefLang: "x-default", href: seo.canonicalUrl },
          { rel: "publisher", href: SITE_URL },
        ],
    scripts: schemas.map((schema) => ({
      type: "application/ld+json",
      children: JSON.stringify(schema).replace(/</g, "\\u003c"),
    })),
  };
}

export function privateRouteHead(title: string) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    meta: [
      { title: fullTitle },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
      { name: "googlebot-news", content: "noindex, nofollow" },
    ],
    links: [],
  };
}
