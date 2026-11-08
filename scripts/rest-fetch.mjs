// Shared read-only REST fetch for sitemap generation and prerender.
// Bounded retry (max 3 attempts) with exponential backoff + full jitter, only for transient
// failures: network errors and HTTP 408, 429, 5xx. Any other status, or the last failed attempt,
// throws (fail closed). Never returns stale or partial data.
export const MAX_ATTEMPTS = 3;
export const isTransientStatus = (s) => s === 408 || s === 429 || (s >= 500 && s <= 599);
export const backoffMs = (attempt, base = 500, rand = Math.random) => Math.floor(rand() * base * 2 ** (attempt - 1));

export async function restFetch(url, init, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), rand = Math.random, label = url } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (e) {
      lastErr = new Error(`${label}: network error (${e?.message || e})`);
      if (attempt < MAX_ATTEMPTS) { await sleep(backoffMs(attempt, 500, rand)); continue; }
      throw lastErr;
    }
    if (res.ok) return res.json();
    lastErr = new Error(`${label}: HTTP ${res.status}`);
    if (!isTransientStatus(res.status) || attempt === MAX_ATTEMPTS) throw lastErr;
    await sleep(backoffMs(attempt, 500, rand));
  }
  throw lastErr;
}
