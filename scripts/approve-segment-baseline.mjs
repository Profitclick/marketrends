import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkpointKey} from './segment-register.mjs';
import {INVENTORY, REV, SNAP, verifyHttpTimings, verifyProgress} from './segmented-recovery-guard.mjs';

const recent = process.argv[5] === '--vekttap';
const source = recent ? {id:15086417171,run:45752542669,head:'bfa6bd8400500a70cb13f2f464bf8dfc47193922',
  sha256:'39c14deb104911c8b67e98b5bb49b1e62fb7b84a6001a56cf2e9b7038a34fb8d'} : {id: 15077387574, run: 45732598155, head: 'fe659474341994c582c0f2a8d2d10bf04de3a393',
  sha256: 'f81ab484eb3e7b6dd13e3b81790e259cb4174d9d4f390430e1ec81a68294ab8a'};
const quarantine = recent ? {id:15086509707,run:45753332362,head:'f853e6e91c538a14c76991110e6c3a09d7972b06',
  sha256:'136d0e76d49ae9f6285961931ab1b9f8c25cbfbb9a60968815bccdf2c90c4619',
  key:'156e0405b7b92e16e1c028b1962bd1e708aade889c7f1190f89873730efed024',
  commit:'725bc76e96b8bf5773c2e81de1d9c6277d0de758'} : {id: 15078471519, run: 45733508942, head: '314467c13149946c3b1637717aa609c9927f013f',
  sha256: '5e6cf4312d4dffbd6c227357e74912f2cc46ce16f76d75c921e641cfe0979ec0',
  key: '378f3cd4d4203dacf5e900cc3d9d0fb1a3feef7b79e69f2b9e87a901c5d1d1d6',
  commit: 'cfb4cc9cba955df691c69bd2bc0fd25cda3f8c6e'};
const pending = recent ? 'https://marketrends.no/vekttap-preger-harbehandlingsmarkedet' : 'https://marketrends.no/arm-sterk-ettersporsel-baksettes-av-produksjonskapasitet';
const rawTitle = recent ? ' Vekttap preger hårbehandlingsmarkedet ' : 'ARM: Sterk  etterspørsel baksettes av produksjonskapasitet';
const prior = recent ? 3471 : 2722;
const priorHistory = recent ? 3475 : 2725;
const passed = prior + 249;
const historyLength = priorHistory + 250;
const untested = INVENTORY - prior - 250;
const issue = 'ARTICLE_HEADLINE_MISMATCH';
const recoveryFiles=['snapshot.json','checkpoint.json','attempt-history.jsonl','results.jsonl','summary.json'];
const sha256 = content => createHash('sha256').update(content).digest('hex');
const rows = text => {
  assert.ok(text.endsWith('\n'), 'Expected a complete JSONL file');
  return text.trimEnd().split('\n').map(JSON.parse);
};

function openArchive(file, expected) {
  assert.equal(sha256(fs.readFileSync(file)), expected.sha256, 'ZIP digest');
  execFileSync('unzip', ['-tq', file], {stdio: 'pipe'});
  return (name, encoding = 'utf8') => execFileSync('unzip', ['-p', file, name],
    {encoding, maxBuffer: 8 * 1024 * 1024});
}

function verifyHeadline(evaluate, entry, row) {
  const url = entry.url;
  const html = title => `<html><head><title>${rawTitle} | Marketrends.no</title>
<link rel="canonical" href="${url}"><meta property="og:url" content="${url}">
<meta name="description" content="Offline fixture"><meta name="robots" content="index">
<meta name="googlebot" content="index"><script type="application/ld+json">${JSON.stringify({
  '@type': 'NewsArticle', headline: title, mainEntityOfPage: {'@id': url},
  author: {'@type': 'Organization', name: 'Marketrends.no'}, isBasedOn: 'https://example.invalid/',
})}</script></head><body><main><article><h1>${rawTitle}</h1>
<a href="https://example.invalid/">Source</a></article></main></body></html>`;
  const headers = new Headers({'content-type':'text/html'});
  const unchanged = evaluate(entry, 200, headers, html(rawTitle.substring(0,110)));
  assert.equal(unchanged.h1,row.h1);
  assert.equal(unchanged.title,row.title);
  assert.deepEqual(unchanged.issues,[issue]);
  const normalized = rawTitle.replace(/\s+/g,' ').trim();
  assert.deepEqual(evaluate(entry,200,headers,html(normalized.substring(0,110))).issues,[]);
  return {sourceTitle:rawTitle, sourceUpdatedAt:'2026-11-02T02:50:30.965286+00:00',
    observedH1:row.h1, structuredHeadline:rawTitle.substring(0,110), issue, normalizedTitle:normalized};
}

const [sourceFile, quarantineFile, output] = process.argv.slice(2);
assert.ok(output && !fs.existsSync(output), 'Specify a new output directory');
const base = openArchive(sourceFile,source);
const stopped = openArchive(quarantineFile,quarantine);
const json = (get,name) => JSON.parse(get(name));
const gate = json(stopped,'segment-gate.json');
assert.deepEqual(gate,json(stopped,'guard-stop.json'));
assert.deepEqual({status:gate.status, code:gate.code, phase:gate.phase, started:gate.started,
  revision:gate.recoveryRevision, resumeAllowed:gate.resumeAllowed},
{status:'QUARANTINE',code:'SEGMENT_NOT_PASS',phase:'passive',started:250,revision:REV,resumeAllowed:false});
const sourceGate = json(base,'segment-gate.json');
assert.equal(sourceGate.status,'PASS');
assert.equal(sourceGate.passed,prior);
assert.equal(sourceGate.historyLength,priorHistory);
const reservation=json(stopped,'segment-reservation.json');
assert.deepEqual(reservation,{version:1,status:'RESERVED',key:quarantine.key,runId:String(quarantine.run),
  sourceId:String(source.id),sourceSha:source.sha256,limit:250,
  ...(recent?{baselineArtifactId:'15080475107'}:{})});
const original=json(base,'recovery/checkpoint.json');
const state=json(stopped,'recovery/checkpoint.json');
const snapshot=stopped('recovery/snapshot.json',null);
assert.ok(snapshot.equals(base('recovery/snapshot.json',null)));
assert.equal(checkpointKey({recoveryRevision:REV,snapshotSha256:SNAP,sourceJournalSha256:original.journalSha256}),quarantine.key);
assert.equal(base('recovery/attempt-history.jsonl'),original.journal);
assert.equal(stopped('recovery/attempt-history.jsonl'),state.journal);
const targets=json(stopped,'targets.json');
const starts=rows(stopped('probe-starts.jsonl')).map(row=>row.url);
assert.equal(starts.length,250);
const attempted=verifyProgress(snapshot,state,original,targets,starts);
assert.equal(attempted.length,250);
verifyHttpTimings(attempted,rows(stopped('http-timings.jsonl')));
const runtimeReport=json(stopped,'runtime-reconciliation.json');
assert.deepEqual(runtimeReport,{journalAttempts:250,journalHttpResponses:250,runtimeGetLines:250,matched:250,missing:0,extra:0});
const stats=json(stopped,'diagnostic-results.json');
assert.ok(stats.passiveSeconds>=120);
assert.ok(attempted.every(row=>row.status===200));
assert.deepEqual(attempted.filter(row=>row.issues.length).map(row=>[row.url,row.issues]),[[pending,[issue]]]);

const {openCheckpoint,auditRevision}=await import(pathToFileURL(path.resolve('scripts/full-sitemap-checkpoint.mjs')));
const {evaluate}=await import(pathToFileURL(path.resolve('scripts/full-sitemap-ssr-audit.mjs')));
assert.equal(auditRevision(true),REV);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'marketrends-baseline-'));
try {
  for(const [dir,archive] of [['before',base],['after',stopped]]) {
    const destination=path.join(temporary,dir);
    fs.mkdirSync(destination);
    for(const file of recoveryFiles) fs.writeFileSync(path.join(destination,file),archive('recovery/'+file,null));
  }
  const before=openCheckpoint({dir:path.join(temporary,'before'),resume:true,revision:REV,limit:250});
  const after=openCheckpoint({dir:path.join(temporary,'after'),resume:true,revision:REV,limit:INVENTORY});
  assert.deepEqual(before.pending,targets);
  assert.deepEqual(after.latest(),rows(stopped('recovery/results.jsonl')));
  assert.deepEqual(before.latest(),rows(base('recovery/results.jsonl')));
  assert.equal(after.pending[0].url,pending);
  assert.equal(after.snapshot.entries.length,INVENTORY);
  assert.equal(after.latest().length,passed+1);
  assert.equal(after.latest().filter(row=>!row.issues.length).length,passed);
  assert.equal(after.pending.length,untested+1);
  assert.equal(rows(state.journal).length,historyLength);
  const failingRow=after.latest().find(row=>row.url===pending);
  const summary=json(stopped,'recovery/summary.json');
  assert.equal(summary.attempted,passed+1);
  assert.equal(summary.passed,passed);
  assert.equal(summary.failed,1);
  assert.equal(summary.untested,untested);
  assert.equal(summary.complete,false);
  const headline=verifyHeadline(evaluate,after.pending[0],failingRow);
  const approval={
    status:recent&&process.argv[6]!=='--approved'?'REVIEW_REQUIRED':'APPROVED_BASELINE',liveAuthorized:false,releaseComplete:false,recoveryRevision:REV,snapshotSha256:SNAP,
    checkpointKey:checkpointKey({recoveryRevision:REV,snapshotSha256:SNAP,sourceJournalSha256:state.journalSha256}),
    sourceJournalSha256:state.journalSha256,source,quarantine,auditedSegment:{attempted:250,passed:249,failed:1},
    inventory:{total:INVENTORY,attempted:passed+1,passed,failed:1,untested,remaining:untested+1,historyLength},
    firstPendingUrl:pending,headline,
  };
  fs.mkdirSync(output);
  fs.cpSync(path.join(temporary,'after'),path.join(output,'recovery'),{recursive:true,errorOnExist:true});
  fs.writeFileSync(path.join(output,'baseline-approval.json'),JSON.stringify(approval,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(approval));
} finally {
  fs.rmSync(temporary,{recursive:true,force:true});
}
