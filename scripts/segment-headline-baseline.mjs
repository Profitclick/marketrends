import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const HEADLINE_BASELINE = Object.freeze({
  id: '15080475107',
  sha256: '617a815c2dc26b0449ef4d5a83e0d4152b61382b992dc5286483585b9cbcf688',
  run: '45738081755',
  key: '97c3975250f5ae98a9be85c1ab1ea52465aac4815deda671320e1fa1915632e8',
  journalSha256: '2c1c7e9c62364882643e62386f72ed1bcff9c425fc58cb5e98fad2ba22b94d17',
  quarantineKey: '378f3cd4d4203dacf5e900cc3d9d0fb1a3feef7b79e69f2b9e87a901c5d1d1d6',
  quarantineCommit: 'cfb4cc9cba955df691c69bd2bc0fd25cda3f8c6e',
  slug: 'arm-sterk-ettersporsel-baksettes-av-produksjonskapasitet',
  title: 'ARM: Sterk etterspørsel baksettes av produksjonskapasitet',
  prior: 2971,
  history: 2975,
});
export const HEADLINE_URL = 'https://marketrends.no/' + HEADLINE_BASELINE.slug;

export function checkApprovedBaseline(plan, manifest, key) {
  const pinned = HEADLINE_BASELINE;
  assert.equal(plan.sourceId, pinned.id, 'HEADLINE_BASELINE_SOURCE');
  assert.equal(plan.sourceSha, pinned.sha256, 'HEADLINE_BASELINE_DIGEST');
  assert.equal(plan.baselineArtifactId, pinned.id, 'HEADLINE_BASELINE_LINEAGE');
  assert.equal(plan.prior, pinned.prior, 'HEADLINE_BASELINE_PASSED');
  assert.equal(plan.historyCount, pinned.history, 'HEADLINE_BASELINE_HISTORY');
  assert.equal(plan.sourceJournalSha256, pinned.journalSha256, 'HEADLINE_BASELINE_JOURNAL');
  assert.equal(key, pinned.key, 'HEADLINE_BASELINE_KEY');
  assert.equal(manifest.status, 'APPROVED_BASELINE', 'HEADLINE_BASELINE_APPROVAL');
  assert.equal(manifest.liveAuthorized, false);
  assert.equal(manifest.releaseComplete, false);
  assert.equal(manifest.recoveryRevision, plan.recoveryRevision);
  assert.equal(manifest.snapshotSha256, plan.snapshotSha256);
  assert.equal(manifest.checkpointKey, key);
  assert.equal(manifest.sourceJournalSha256, pinned.journalSha256);
  assert.equal(manifest.quarantine.key, pinned.quarantineKey);
  assert.equal(manifest.quarantine.commit, pinned.quarantineCommit);
  assert.equal(manifest.firstPendingUrl, HEADLINE_URL);
  assert.deepEqual(manifest.inventory, {total:5276,attempted:2972,passed:2971,
    failed:1,untested:2304,remaining:2305,historyLength:2975});
}

export function hasApprovedJournalPrefix(journal) {
  const prefix = journal.split('\n').slice(0, HEADLINE_BASELINE.history).join('\n') + '\n';
  return createHash('sha256').update(prefix).digest('hex') === HEADLINE_BASELINE.journalSha256;
}

export function headlinePreflight(rows) {
  assert.ok(Array.isArray(rows) && rows.length === 1 &&
    rows[0]?.slug === HEADLINE_BASELINE.slug && rows[0]?.title === HEADLINE_BASELINE.title,
  'HEADLINE_BASELINE_TITLE_NOT_READY');
  return {status:'READY',baselineArtifactId:HEADLINE_BASELINE.id,url:HEADLINE_URL,title:HEADLINE_BASELINE.title};
}

async function livePreflight(env) {
  const endpoint = new URL(env.VITE_SUPABASE_URL);
  assert.equal(endpoint.origin,'https://jsfzdlgfxvnlosrsafjw.lovable.cloud');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(key?.startsWith('sb_publishable_') ||
    JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon', 'Expected the publishable key');
  const url = new URL('/rest/v1/articles', endpoint);
  url.search = new URLSearchParams({select:'slug,title',slug:'eq.'+HEADLINE_BASELINE.slug,published:'eq.true',limit:'2'});
  const response = await fetch(url, {headers:{apikey:key},redirect:'error',signal:AbortSignal.timeout(10000)});
  assert.ok(response.ok, 'HEADLINE_BASELINE_TITLE_UNAVAILABLE');
  return headlinePreflight(await response.json());
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const env=process.env;
    assert.equal(env.SEGMENT_SOURCE_ID,HEADLINE_BASELINE.id);
    assert.equal(env.SEGMENT_SOURCE_SHA,HEADLINE_BASELINE.sha256);
    const evidence=await livePreflight(env);
    fs.writeFileSync(path.join(env.SEGMENT_EVIDENCE,'headline-preflight.json'),JSON.stringify(evidence)+'\n',{flag:'wx'});
    console.log('APPROVED BASELINE HEADLINE READY');
  } catch (error) {
    console.error(error.message==='HEADLINE_BASELINE_TITLE_NOT_READY' ? error.message : 'HEADLINE_BASELINE_PREFLIGHT_FAILED');
    process.exitCode=70;
  }
}
