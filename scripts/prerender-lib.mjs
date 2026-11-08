// Pure helpers for build-time prerendering of public routes. No network, no AI.
export const SITE = "https://marketrends.no";
export const CATEGORY_SLUGS = ["krypto-trading", "teknologi-ai", "finans-marked", "grunder-startups", "penger-karriere", "trender-analyse", "guider-forklart"];
export const EXCLUDED = ["/dashboard", "/admin", "/auth"];

export const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLd = (o) => `<script type="application/ld+json" data-prerender>${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

export const categorySlug = (c = "") => {
  const s = c.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return CATEGORY_SLUGS.includes(s) ? s : null;
};

// Strip markdown to readable plain paragraphs (existing content only).
export const paragraphs = (md = "", max = 6) =>
  md.split(/\n{2,}/).map((p) => p.replace(/^#+\s*/gm, "").replace(/\*\*|__|\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
    .filter((p) => p.length > 40 && !/^[-|>]/.test(p)).slice(0, max);

export const truncate = (s = "", n = 158) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

export function breadcrumb(items) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, ...(it.path != null ? { item: SITE + it.path } : {}) })),
  };
}

export function isCanonicalSafe(url) {
  return url.startsWith(SITE + "/") && !/lovable\.app|supabase|workers\.dev|ed73ad9f/.test(url);
}

// Build head + body for a route description. page = { path, title, description, h1, intro[], links[{href,text}], schemas[], type, image }
export function renderRoute(template, page) {
  if (EXCLUDED.some((p) => page.path === p || page.path.startsWith(p + "/"))) throw new Error(`excluded route ${page.path}`);
  if (!page.title || !page.h1) throw new Error(`missing title/h1 for ${page.path}`);
  const url = SITE + page.path;
  if (!isCanonicalSafe(url)) throw new Error(`unsafe canonical ${url}`);
  const title = esc(page.title), desc = esc(truncate(page.description || page.title));
  const head = [
    `<title data-prerender>${title}</title>`,
    `<meta name="description" content="${desc}" data-prerender>`,
    `<link rel="canonical" href="${esc(url)}" data-prerender>`,
    ...["nb", "no", "x-default"].map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(url)}" data-prerender>`),
    `<meta property="og:type" content="${page.type || "website"}" data-prerender>`,
    `<meta property="og:url" content="${esc(url)}" data-prerender>`,
    `<meta property="og:title" content="${title}" data-prerender>`,
    `<meta property="og:description" content="${desc}" data-prerender>`,
    `<meta name="twitter:url" content="${esc(url)}" data-prerender>`,
    `<meta name="twitter:title" content="${title}" data-prerender>`,
    `<meta name="twitter:description" content="${desc}" data-prerender>`,
    ...(page.image && /^https:\/\//.test(page.image) ? [`<meta property="og:image" content="${esc(page.image)}" data-prerender>`, `<meta name="twitter:image" content="${esc(page.image)}" data-prerender>`] : []),
    ...(page.schemas || []).map(jsonLd),
  ].join("\n    ");
  const body = [
    `<main data-prerender-body>`,
    `<nav aria-label="Hovedmeny"><a href="/">Marketrends.no</a> ${["ai", "krypto", "fintech", "investering", "daytrading", "startup"].map((v) => `<a href="/${v}">${v}</a>`).join(" ")}</nav>`,
    `<${page.type === "article" ? "article" : "section"}>`,
    `<h1>${esc(page.h1)}</h1>`,
    ...(page.meta || []).map((m) => `<p>${m}</p>`),
    ...(page.intro || []).map((p) => `<p>${esc(p)}</p>`),
    `</${page.type === "article" ? "article" : "section"}>`,
    ...(page.links?.length ? [`<ul>${page.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.text)}</a></li>`).join("")}</ul>`] : []),
    `</main>`,
  ].join("\n");

  let html = template
    // Remove generic route-level tags so they cannot override the route's own metadata.
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta\s+(name|property)="(title|description|og:url|og:title|og:description|og:type|twitter:url|twitter:title|twitter:description)"[^>]*>\s*/g, "")
    .replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]*"\s*\/?>\s*/g, "")
    .replace(/<link rel="canonical"[^>]*>\s*/g, "");
  if (page.image && /^https:\/\//.test(page.image)) html = html.replace(/<meta (property="og:image"|name="twitter:image") content="[^"]*">\s*/g, "");
  if (!html.includes('<div id="root"></div>')) throw new Error("template root not found");
  return html.replace("</head>", `    ${head}\n  </head>`).replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

export function articlePage(a) {
  const path = `/${a.slug}`;
  const cat = categorySlug(a.category);
  const date = a.created_at;
  const crumbs = [{ name: "Forside", path: "/" }, ...(cat ? [{ name: a.category, path: `/kategori/${cat}` }] : []), { name: a.title }];
  const topics = (a.article_topics || []).map((t) => t.topics).filter(Boolean).slice(0, 8);
  return {
    path, type: "article", title: `${a.title} | Marketrends.no`, h1: a.title,
    description: a.meta_description || paragraphs(a.content, 1)[0] || a.title, image: a.image_url,
    meta: [
      `Publisert <time datetime="${esc(date)}">${esc(date.slice(0, 10))}</time>`,
      ...(a.source_name ? [`Kilde: ${a.source_url ? `<a href="${esc(a.source_url)}" rel="nofollow noopener">${esc(a.source_name)}</a>` : esc(a.source_name)}`] : []),
    ],
    intro: paragraphs(a.content, 6),
    links: [...(cat ? [{ href: `/kategori/${cat}`, text: a.category }] : []), ...topics.map((t) => ({ href: `/topic/${t.slug}`, text: t.name }))],
    schemas: [
      {
        "@context": "https://schema.org", "@type": "NewsArticle", headline: truncate(a.title, 110),
        description: truncate(a.meta_description || "", 300) || undefined, datePublished: date, dateModified: a.updated_at || date,
        mainEntityOfPage: SITE + path, url: SITE + path, inLanguage: "nb-NO",
        ...(a.image_url ? { image: [a.image_url] } : {}),
        author: { "@type": "Organization", name: "Marketrends.no", url: SITE },
        publisher: { "@type": "NewsMediaOrganization", name: "Marketrends.no", url: SITE },
        ...(a.source_name ? { isBasedOn: a.source_url || undefined } : {}),
      },
      breadcrumb(crumbs),
    ],
  };
}

export function listPage({ path, title, h1, description, items, crumbName, extraIntro = [] }) {
  return {
    path, title, h1, description, intro: [description, ...extraIntro].filter(Boolean),
    links: items.map((a) => ({ href: `/${a.slug}`, text: a.title })),
    schemas: crumbName ? [breadcrumb([{ name: "Forside", path: "/" }, { name: crumbName }])] : [],
  };
}

export function hubPage({ prefix, row, label, articles = [] }) {
  const name = row.name || row.title;
  const desc = row.meta_description || row.summary || row.description || `${label}: ${name} på Marketrends.no.`;
  return {
    path: `${prefix}${row.slug}`, title: row.meta_title || `${name} | Marketrends.no`, h1: name, description: desc,
    intro: [row.summary || row.description, ...(row.content ? paragraphs(row.content, 4) : [])].filter(Boolean),
    links: articles.map((a) => ({ href: `/${a.slug}`, text: a.title })),
    schemas: [breadcrumb([{ name: "Forside", path: "/" }, { name }])],
  };
}
