import { Helmet } from "react-helmet";

type SchemaType = "article" | "knowledge" | "guide" | "comparison" | "entity" | "topic" | "cluster";

interface Props {
  type: SchemaType;
  url: string;
  name: string;
  description?: string;
  data?: any;
}

const BASE = "https://marketrends.no";

export const AnswerSchema = ({ type, url, name, description, data = {} }: Props) => {
  const speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: [".article-ingress", ".key-takeaways", ".tldr"],
  };

  let schema: any = {};

  if (type === "article") {
    schema = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: name,
      description,
      url,
      datePublished: data.published_at,
      dateModified: data.updated_at || data.published_at,
      author: data.author ? { "@type": "Person", name: data.author } : { "@type": "Organization", name: "Marketrends" },
      publisher: { "@type": "Organization", name: "Marketrends", url: BASE },
      mainEntityOfPage: url,
      image: data.image_url,
      about: (data.topics || []).map((t: any) => ({ "@type": "Thing", name: t.name, url: `${BASE}/topic/${t.slug}` })),
      mentions: (data.entities || []).map((e: any) => ({ "@type": "Thing", name: e.name, url: `${BASE}/entity/${e.slug}` })),
      citation: (data.sources || []).map((s: any) => ({ "@type": "CreativeWork", name: s.title || s.name, url: s.url })),
      speakable,
    };
  } else if (type === "knowledge") {
    schema = {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name,
      description,
      url,
      inDefinedTermSet: BASE,
      speakable,
    };
  } else if (type === "guide") {
    schema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name,
      description,
      url,
      step: (data.steps || []).map((s: any, i: number) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.title || `Steg ${i + 1}`,
        text: s.text || s.body || "",
      })),
      speakable,
    };
  } else if (type === "comparison") {
    schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name,
      description,
      url,
      itemListElement: (data.items || []).map((it: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "Thing", name: it.name, url: it.url },
      })),
    };
  } else if (type === "entity") {
    schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      description,
      url,
      sameAs: (data.sameAs || []).filter(Boolean),
    };
  } else if (type === "topic") {
    schema = {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name,
      description,
      url,
      inDefinedTermSet: BASE,
    };
  } else if (type === "cluster") {
    schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name,
      description,
      url,
      mainEntity: data.faq
        ? {
            "@type": "FAQPage",
            mainEntity: (data.faq || []).map((f: any) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }
        : undefined,
    };
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

export default AnswerSchema;
