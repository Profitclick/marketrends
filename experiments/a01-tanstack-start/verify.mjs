const ORIGIN = process.env.A01_ORIGIN || 'http://127.0.0.1:3000'

const checks = [
  ['homepage', '/', 200],
  ['valid_ai', '/ai', 200],
  ['valid_category', '/kategori/krypto-trading', 200],
  ['unknown', '/audit-01-unknown-route-20261119', 404],
  ['invalid_category', '/kategori/audit01-invalid', 404],
  ['invalid_topic', '/topic/audit01-invalid', 404],
  ['invalid_entity', '/entity/audit01-invalid', 404],
  ['invalid_guide', '/guide/audit01-invalid', 404],
  ['invalid_knowledge', '/knowledge/audit01-invalid', 404],
  ['invalid_compare', '/compare/audit01-invalid', 404],
  ['invalid_intent', '/intent/audit01-invalid', 404],
  ['invalid_cluster', '/cluster/audit01-invalid', 404],
  ['legacy_cluster', '/cluster/ai', 308, '/ai'],
]

let failed = 0
for (const [id, path, expectedStatus, expectedLocation] of checks) {
  const url = new URL(path, ORIGIN)
  const response = await fetch(url, { redirect: 'manual' })
  const location = response.headers.get('location')
  const locationPath = location ? new URL(location, url).pathname : null
  const pass =
    response.status === expectedStatus &&
    (!expectedLocation || locationPath === expectedLocation)

  console.log(JSON.stringify({
    id,
    path,
    status: response.status,
    expectedStatus,
    location,
    expectedLocation: expectedLocation || null,
    pass,
  }))

  if (!pass) failed += 1
}

if (failed) {
  console.error(`A01 TanStack feasibility failed: ${failed} checks`)
  process.exit(1)
}

console.log(`A01 TanStack feasibility passed: ${checks.length} raw HTTP checks`)
