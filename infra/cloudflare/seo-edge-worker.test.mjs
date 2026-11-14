import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, initialHtmlCanonical, clusterDecision } from './seo-edge-worker.mjs';
const ROOT = 'https://marketrends.no';
const preview = 'https://marketrends-seo-probe.copytrader-net.workers.dev';
const html = (canonical, body = 'Content') => `<!doctype html><html><head><title>Test</title><link href="${canonical}" rel="canonical"></head><body><h1>${body}</h1></body></html>`;
const upstream = (text, headers = { 'content-type': 'text/html; charset=utf-8' }, status = 200) => async () => new Response(text, { status, headers });
const stage = (path) => new Request(`${preview}${path}`);
const options = (text) => ({stagingOrigin: ROOT, upstreamFetch: upstream(text)});

test('only canonical verticals receive a real server redirect', async () => {
  for (const slug of ['ai', 'krypto', 'fintech', 'investering', 'daytrading', 'startup']) {
    const r = await handleRequest(stage(`/cluster/${slug}`), options('unused'));
    assert.equal(r.status, 308);
    assert.equal(r.headers.get('Location'), `${ROOT}/${slug}`);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
});
test('unknown clusters and nested cluster paths give real HTTP 404', async () => {
  for (const path of ['/cluster/missing', '/cluster/ai/extra', '/cluster/', '/cluster']) {
    const r = await handleRequest(stage(path), options('unused'));
    assert.equal(r.status, 404);
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.doesNotMatch(await r.text(), /rel="canonical"/);
  }
});
test('unknown URL with homepage prerender signature gives real 404', async () => {
  const r = await handleRequest(stage('/unknown-20261114'), options(html(`${ROOT}/`, 'Homepage')));
  assert.equal(r.status, 404);
  assert.doesNotMatch(await r.text(), /Homepage/);
});
test('valid article and vertical self-canonical HTML are unchanged', async () => {
  for (const route of ['/ai', '/verified-article']) {
    const document = html(`${ROOT}${route}`, route);
    const r = await handleRequest(stage(route), options(document));
    assert.equal(r.status, 200);
    assert.equal(await r.text(), document);
  }
});
test('private shell with no canonical is passed through without public canonical', async () => {
  const privateDocument = '<!doctype html><html><head><meta name="robots" content="noindex,nofollow"></head><body>Login</body></html>';
  const r = await handleRequest(stage('/auth'), options(privateDocument));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), privateDocument);
  assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
});
test('XML, binary responses and upstream HTTP errors remain unchanged', async () => {
  for (const [path, ct, contents, status] of [
    ['/sitemap-index.xml', 'application/xml', '<sitemapindex />', 200],
    ['/robots.txt', 'text/plain', 'User-agent: *', 200],
    ['/not-available', 'text/html', 'Unavailable', 503],
  ]) {
    const r = await handleRequest(stage(path), {stagingOrigin: ROOT, upstreamFetch: upstream(contents, {'content-type': ct}, status)});
    assert.equal(r.status, status);
    assert.equal(await r.text(), contents);
  }
});
test('HEAD on unknown route returns 404 without body', async () => {
  const r = await handleRequest(new Request(`${preview}/missing`, {method:'HEAD'}), options(html(`${ROOT}/`)));
  assert.equal(r.status, 404);
  assert.equal(await r.text(), '');
});
test('wrong or missing production hostname fails closed', async () => {
  const r = await handleRequest(stage('/ai'), {upstreamFetch:upstream('ignored')});
  assert.equal(r.status, 503);
  const wrong = await handleRequest(stage('/ai'), {stagingOrigin:'https://some-other-host.tld', upstreamFetch:upstream('ignored')});
  assert.equal(wrong.status, 503);
});
test('link canonical extraction handles attribute order and absent canonical', () => {
  assert.equal(initialHtmlCanonical(html(`${ROOT}/`)), `${ROOT}/`);
  assert.equal(initialHtmlCanonical('<head><meta name="robots" content="noindex"></head>'), null);
  assert.deepEqual(clusterDecision('/not-a-cluster'), null);
});
