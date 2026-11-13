import fs from "node:fs";
import path from "node:path";

// Static application shells only: no protected data and no editorial prerendering.
export const PRIVATE_ROUTES = [
  ["/admin", "Admin"],
  ["/auth", "Logg inn"],
  ["/dashboard", "Dashboard"],
];

export function renderPrivateRoute(template, route, label) {
  if (!PRIVATE_ROUTES.some(([candidate]) => candidate === route)) throw new Error(`unknown private route ${route}`);
  if (!template.includes('<div id="root">')) throw new Error("template root not found");

  let html = template
    .replace(/<title(?:\s[^>]*)?>[\s\S]*?<\/title>\s*/g, "")
    .replace(/<meta\s+(?:name|property)="(?:title|description|robots|googlebot|googlebot-news|og:url|og:title|og:description|og:type|twitter:url|twitter:title|twitter:description)"[^>]*>\s*/g, "")
    .replace(/<link rel="(?:canonical|alternate)"[^>]*>\s*/g, "")
    .replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');

  const head = [
    `<title>${label} | Marketrends.no</title>`,
    '<meta name="description" content="Intern side for Marketrends.no.">',
    '<meta name="robots" content="noindex, nofollow">',
    '<meta name="googlebot" content="noindex, nofollow">',
  ].join("\n    ");
  html = html.replace("</head>", `    ${head}\n  </head>`);

  if (/<div id="root">[\s\S]*?<\/div>/.exec(html)?.[0] !== '<div id="root"></div>') throw new Error(`private root not empty for ${route}`);
  return html;
}

export function generatePrivateRoutes(outDir, io = fs) {
  const template = io.readFileSync(path.join(outDir, "index.html"), "utf8");
  const files = [];
  for (const [route, label] of PRIVATE_ROUTES) {
    const file = path.join(outDir, route.slice(1), "index.html");
    io.mkdirSync(path.dirname(file), { recursive: true });
    io.writeFileSync(file, renderPrivateRoute(template, route, label), "utf8");
    files.push(file);
  }
  return files;
}
