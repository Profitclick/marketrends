import fs from "node:fs";
import path from "node:path";

const SITE = "https://marketrends.no";

export function generate404(outDir) {
  const html = `<!doctype html>
<html lang="nb">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Siden finnes ikke – Marketrends.no</title>
  <meta name="robots" content="noindex, follow" />
  <meta name="googlebot" content="noindex, follow" />
  <meta name="description" content="Siden finnes ikke på Marketrends.no." />
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { max-width: 34rem; padding: 2rem; text-align: center; }
    .code { font-size: .8rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .65; }
    h1 { font-family: Georgia, serif; font-size: clamp(2rem, 6vw, 3.5rem); margin: .75rem 0; }
    p { line-height: 1.6; opacity: .75; }
    a { display: inline-block; margin-top: 1rem; color: inherit; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="code">404</div>
    <h1>Siden finnes ikke</h1>
    <p>Lenken kan være utdatert eller feilstavet.</p>
    <a href="${SITE}/">Til forsiden</a>
  </main>
</body>
</html>`;
  const target = path.join(outDir, "404.html");
  fs.writeFileSync(target, html, "utf8");
  return target;
}
