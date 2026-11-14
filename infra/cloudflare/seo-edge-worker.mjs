// Cloudflare Worker: edge-only HTTP routing for Marketrends.
// DO NOT attach to apex until Lovable's supported CDN/proxy CNAME mode has
// been independently verified with a test hostname and an origin rollback plan.
// Stage mode: STAGING_ORIGIN must be exactly https://marketrends.no, never a
// second Cloudflare Worker or an unverified alternate Lovable hostname.
const CANONICAL_ORIGIN = 'https://marketrends.no';
const VERTICALS = new Set(['ai', 'krypto', 'fintech', 'investering', 'daytrading', 'startup']);
const HTML_404 = `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><meta name="googlebot" content="noindex, follow"><title>Siden finnes ikke | Marketrends.no</title></head><body><main><h1>Siden finnes ikke</h1><p>Kontroller adressen, eller gå til <a href="https://marketrends.no/">forsiden</a>.</p></main></body></html>`;

export function notFound(method = 'GET') {
  return new Response(method === 'HEAD' ? null : HTML_404, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, follow',
      'X-Marketrends-Edge-Status': '404',
    },
  });
}

export function clusterDecision(pathname) {
  if (pathname !== '/cluster' && !pathname.startsWith('/cluster/')) return null;
  const match = /^\/cluster\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (match && VERTICALS.has(match[1])) {
    return { type: 'redirect', location: `${CANONICAL_ORIGIN}/${match[1]}` };
  }
  return { type: 'not_found' };
}

function attr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(re)?.[2] ?? null;
}
export function initialHtmlCanonical(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    if ((attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical')) {
      return attr(tag, 'href');
    }
  }
  return null;
}

function asPreview(response, preview) {
  if (!preview) return response;
  // Preview must never create a competing indexable hostname.
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export async function handleRequest(request, { upstreamFetch = fetch, stagingOrigin } = {}) {
  const url = new URL(request.url);
  const preview = Boolean(stagingOrigin);
  if (preview && stagingOrigin !== CANONICAL_ORIGIN) {
    return new Response('Invalid staging origin configuration', { status: 503 });
  }
  if (!preview && url.hostname !== 'marketrends.no') {
    return new Response('Not configured as canonical edge', { status: 503 });
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const cluster = clusterDecision(url.pathname);
    if (cluster?.type === 'redirect') {
      return asPreview(new Response(null, {
        status: 308,
        headers: { Location: cluster.location, 'Cache-Control': 'public, max-age=300', 'X-Marketrends-Edge-Status': '308' },
      }), preview);
    }
    if (cluster?.type === 'not_found') return asPreview(notFound(request.method), preview);
  }

  const upstreamUrl = preview ? `${stagingOrigin}${url.pathname}${url.search}` : request.url;
  const checkBody = request.method === 'HEAD';
  const upstreamRequest = new Request(upstreamUrl, checkBody ? { method: 'GET', headers: request.headers } : request);
  const response = await upstreamFetch(upstreamRequest, { redirect: 'manual' });
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status === 200 && /^\s*text\/html(?:;|$)/i.test(contentType) && url.pathname !== '/' &&
      (request.method === 'GET' || request.method === 'HEAD')) {
    const canonical = initialHtmlCanonical(await response.clone().text());
    // Lovable's unknown-path SPA fallback serves the *prerendered homepage*
    // with the homepage canonical. Only classify this verified signature as 404.
    if (canonical === `${CANONICAL_ORIGIN}/`) return asPreview(notFound(request.method), preview);
  }
  if (checkBody) {
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return asPreview(new Response(null, { status: response.status, headers }), preview);
  }
  return asPreview(response, preview);
}

export default {
  async fetch(request, env) {
    return handleRequest(request, { stagingOrigin: env.STAGING_ORIGIN });
  },
};
