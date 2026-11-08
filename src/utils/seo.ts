export interface ArticleSEO {
  title: string;
  description: string;
  image?: string;
  url: string;
  author: string;
  publishedTime: string;
  modifiedTime?: string;
  category: string;
  tags?: string[];
  wordCount?: number;
}

export interface OrganizationSchema {
  name: string;
  url: string;
  logo: string;
  sameAs?: string[];
}

const SITE_URL = "https://marketrends.no";
const SITE_NAME = "Marketrends.no";

// Generate NewsArticle schema for Google News
export const generateArticleSchema = (article: ArticleSEO) => {
  const wordCount = article.wordCount || 500;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title.substring(0, 110),
    "description": article.description.substring(0, 160),
    "image": [
      article.image || `${SITE_URL}/og-image.jpg`
    ],
    "datePublished": article.publishedTime,
    "dateModified": article.modifiedTime || article.publishedTime,
    "author": {
      "@type": "Person",
      "name": article.author,
      "url": `${SITE_URL}/forfatter/${encodeURIComponent(article.author.toLowerCase().replace(/\s+/g, '-'))}`
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/logo.png`,
        "width": 600,
        "height": 60
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url
    },
    "articleSection": article.category,
    "keywords": article.tags?.join(", ") || article.category,
    "wordCount": wordCount,
    "timeRequired": `PT${readingTime}M`,
    "inLanguage": "nb-NO",
    "isAccessibleForFree": true
  };
};

// Generate Organization schema for homepage
export const generateOrganizationSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "name": SITE_NAME,
    "alternateName": "Marketrends",
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/logo.png`,
      "width": 600,
      "height": 60
    },
    "sameAs": [
      "https://twitter.com/marketrends_no",
      "https://linkedin.com/company/marketrends-no",
      "https://facebook.com/marketrends.no"
    ],
    "foundingDate": "2024",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "NO",
      "addressLocality": "Oslo"
    },
    "description": "Norges ledende kilde for finans, teknologi, krypto og markedsnyheter.",
    "publishingPrinciples": `${SITE_URL}/om-oss#redaksjonelle-retningslinjer`,
    "actionableFeedbackPolicy": `${SITE_URL}/kontakt`
  };
};

// Generate WebSite schema (no unimplemented search action).
export const generateWebsiteSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "alternateName": "Marketrends - Norsk Finans & Teknologinyheter",
    "url": SITE_URL,
    "inLanguage": "nb-NO"
  };
};

// Generate BreadcrumbList schema
export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
};

// Category-specific fallback images — editorial press photography style
// All images: real-world documentary/journalism style, no AI art, no illustrations
export const getCategoryFallbackImage = (category: string, index: number = 0): string => {
  const imageCollections: Record<string, string[]> = {
    "Krypto & Trading": [
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=675&fit=crop", // trading screens close-up
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&h=675&fit=crop", // stock ticker board
      "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=1200&h=675&fit=crop", // trader at monitors
      "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1200&h=675&fit=crop", // bitcoin physical coin on desk
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200&h=675&fit=crop", // financial data screens
    ],
    "Finans & Marked": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=675&fit=crop", // glass office tower exterior
      "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=1200&h=675&fit=crop", // Wall Street sign
      "https://images.unsplash.com/photo-1560472355-536de3962603?w=1200&h=675&fit=crop", // financial district skyline
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200&h=675&fit=crop", // money/documents on desk
      "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=1200&h=675&fit=crop", // business newspaper
    ],
    "Teknologi & AI": [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop", // circuit board macro
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&h=675&fit=crop", // data center servers
      "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&h=675&fit=crop", // woman at tech workstation
      "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&h=675&fit=crop", // code on laptop screen
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=675&fit=crop", // server rack LEDs
    ],
    "Gründer & Startups": [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=675&fit=crop", // modern office space
      "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=675&fit=crop", // business meeting boardroom
      "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&h=675&fit=crop", // team at whiteboard
      "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&h=675&fit=crop", // coworking space
      "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=1200&h=675&fit=crop", // startup office
    ],
    "Penger & Karriere": [
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=675&fit=crop", // signing documents
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=675&fit=crop", // laptop with charts
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=675&fit=crop", // business handshake
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=675&fit=crop", // calculator and papers
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&h=675&fit=crop", // person in suit
    ],
    "Trender & Analyse": [
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=675&fit=crop", // analytics dashboard
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&h=675&fit=crop", // multiple monitors data
      "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=1200&h=675&fit=crop", // graphs on paper
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop", // dashboard screens
      "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=1200&h=675&fit=crop", // chart analysis
    ],
    "Guider & Forklart": [
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=675&fit=crop", // notebook and pen
      "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=1200&h=675&fit=crop", // writing at desk
      "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=1200&h=675&fit=crop", // reading newspaper
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=675&fit=crop", // laptop learning
      "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1200&h=675&fit=crop", // books and coffee
    ],
    "Crypto": [
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&h=675&fit=crop",
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200&h=675&fit=crop",
    ],
    "Tech": [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop",
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&h=675&fit=crop",
    ],
    "Fintech": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=675&fit=crop",
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&h=675&fit=crop",
    ],
    "Money": [
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&h=675&fit=crop",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=675&fit=crop",
    ],
    "default": [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=675&fit=crop", // office tower
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=675&fit=crop", // analytics
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&h=675&fit=crop", // monitors
      "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=1200&h=675&fit=crop", // wall street
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1200&h=675&fit=crop", // laptop work
    ]
  };

  const categoryImages = imageCollections[category] || imageCollections.default;
  return categoryImages[index % categoryImages.length];
};

// Generate hreflang tags for Norwegian content
export const generateHreflangTags = (url: string) => {
  return [
    { hreflang: "nb", href: url },
    { hreflang: "no", href: url },
    { hreflang: "x-default", href: url }
  ];
};

// Calculate word count for articles
export const calculateWordCount = (content: string): number => {
  return content.split(/\s+/).filter(word => word.length > 0).length;
};
