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
export const VEKTTAP_BASELINE = Object.freeze({
  id: '15118945739',
  sha256: '19ef58f65609a2d80252a5730e7e2f8b1b37e21d790e231662dc4f973abe440c',
  run: '45823167223',
  key: 'a30ec0487ecac36e2d45561ea72ba944cef93a3866eeafd244b55aca97d0e5de',
  journalSha256: '046f967d79c7f14d4a1675734673d1221aae6655dee61853495b1c90d1acc365',
  quarantineKey: '156e0405b7b92e16e1c028b1962bd1e708aade889c7f1190f89873730efed024',
  quarantineCommit: '725bc76e96b8bf5773c2e81de1d9c6277d0de758',
  slug: 'vekttap-preger-harbehandlingsmarkedet',
  title: 'Vekttap preger hårbehandlingsmarkedet',
  prior: 3720,
  history: 3725,
});
export const getHeadlineBaseline = id => [HEADLINE_BASELINE,VEKTTAP_BASELINE].find(item=>item.id===id);
export const headlineUrl = pinned => 'https://marketrends.no/' + pinned.slug;


export function checkApprovedBaseline(plan, manifest, key) {
  const pinned = getHeadlineBaseline(plan.sourceId);
  assert.ok(pinned);
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
  assert.equal(manifest.firstPendingUrl, headlineUrl(pinned));
  assert.deepEqual(manifest.inventory, {total:5276,attempted:pinned.prior+1,passed:pinned.prior,
    failed:1,untested:5275-pinned.prior,remaining:5276-pinned.prior,historyLength:pinned.history});
}

export function hasApprovedJournalPrefix(journal,pinned=HEADLINE_BASELINE) {
  const prefix = journal.split('\n').slice(0, pinned.history).join('\n') + '\n';
  return createHash('sha256').update(prefix).digest('hex') === pinned.journalSha256;
}

export function headlinePreflight(rows,pinned=HEADLINE_BASELINE) {
  assert.ok(Array.isArray(rows) && rows.length === 1 &&
    rows[0]?.slug === pinned.slug && rows[0]?.title === pinned.title,
  'HEADLINE_BASELINE_TITLE_NOT_READY');
  return {status:'READY',baselineArtifactId:pinned.id,url:headlineUrl(pinned),title:pinned.title};
}

async function livePreflight(env,pinned) {
  const endpoint = new URL(env.VITE_SUPABASE_URL);
  assert.equal(endpoint.origin,'https://jsfzdlgfxvnlosrsafjw.lovable.cloud');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(key?.startsWith('sb_publishable_') ||
    JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon', 'Expected the publishable key');
  const url = new URL('/rest/v1/articles', endpoint);
  url.search = new URLSearchParams({select:'slug,title',slug:'eq.'+pinned.slug,published:'eq.true',limit:'2'});
  const response = await fetch(url, {headers:{apikey:key},redirect:'error',signal:AbortSignal.timeout(10000)});
  assert.ok(response.ok, 'HEADLINE_BASELINE_TITLE_UNAVAILABLE');
  return headlinePreflight(await response.json(),pinned);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const env=process.env;
    const pinned=getHeadlineBaseline(env.SEGMENT_SOURCE_ID);
    assert.ok(pinned);
    assert.equal(env.SEGMENT_SOURCE_SHA,pinned.sha256);
    const evidence=await livePreflight(env,pinned);
    fs.writeFileSync(path.join(env.SEGMENT_EVIDENCE,'headline-preflight.json'),JSON.stringify(evidence)+'\n',{flag:'wx'});
    console.log('APPROVED BASELINE HEADLINE READY');
  } catch (error) {
    console.error(error.message==='HEADLINE_BASELINE_TITLE_NOT_READY' ? error.message : 'HEADLINE_BASELINE_PREFLIGHT_FAILED');
    process.exitCode=70;
  }
}
