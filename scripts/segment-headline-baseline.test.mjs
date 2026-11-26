import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {getHeadlineBaseline, headlinePreflight, headlineUrl, HEADLINE_BASELINE, HEADLINE_URL} from './segment-headline-baseline.mjs';
import {verifyBaselineFirstResult, verifySegmentSummary, REV, SNAP} from './segmented-recovery-guard.mjs';

test('the first reservation requires the exact normalized headline for the published article', () => {
  const article = {slug:HEADLINE_BASELINE.slug,title:HEADLINE_BASELINE.title};
  assert.equal(headlinePreflight([article]).status,'READY');
  for (const result of [[],[article,article],[{...article,slug:'other'}],
    [{...article,title:article.title.replace('Sterk ','Sterk  ')}]]) {
    assert.throws(() => headlinePreflight(result), /HEADLINE_BASELINE_TITLE_NOT_READY/);
  }
});

test('the first recorded result must resolve the approved pending headline', () => {
  const plan = {sourceId:HEADLINE_BASELINE.id};
  const row = {url:HEADLINE_URL,status:200,issues:[]};
  verifyBaselineFirstResult(plan,[]);
  verifyBaselineFirstResult(plan,[row]);
  for (const changed of [{status:503},{url:'https://marketrends.no/other'},{issues:['ARTICLE_HEADLINE_MISMATCH']}]) {
    assert.throws(() => verifyBaselineFirstResult(plan,[{...row,...changed}]), {code:'BASELINE_HEADLINE_STILL_FAILING'});
  }
  verifyBaselineFirstResult({sourceId:'1'},[{...row,status:503}]);
});

const artifact = process.env.SEGMENT_TEST_APPROVED_BASELINE_DIR;
test('exact offline evaluator preserves the failed row and promotes only its successful recheck', {skip:!artifact}, async t => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'headline-baseline-test-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
  const guard = fileURLToPath(new URL('./segmented-recovery-guard.mjs',import.meta.url));
  const prepare=env=>spawnSync(process.execPath,[guard,'prepare'],{encoding:'utf8',env:{
    ...process.env,SEGMENT_QUARANTINE_DIR:'',SEGMENT_LIMIT:'1',...env
  }});
  const pinned=getHeadlineBaseline(process.env.SEGMENT_TEST_BASELINE_ID??HEADLINE_BASELINE.id);
  const url=headlineUrl(pinned);
  const untested=5275-pinned.prior;
  const first=path.join(temp,'first');
  const initialEnv={SEGMENT_SOURCE_DIR:artifact,SEGMENT_EVIDENCE:first,
    SEGMENT_SOURCE_ID:pinned.id,SEGMENT_SOURCE_SHA:pinned.sha256,
    SEGMENT_PRIOR_PASSED:String(pinned.prior),SEGMENT_PRIOR_HISTORY:String(pinned.history)};
  const bad=prepare({...initialEnv,SEGMENT_SOURCE_SHA:'f'.repeat(64)});
  assert.equal(bad.status,70);
  assert.equal(fs.existsSync(first),false);
  const initial=prepare(initialEnv);
  assert.equal(initial.status,0,initial.stderr);
  const plan=read(path.join(first,'segment-plan.json'));
  assert.equal(plan.baselineArtifactId,pinned.id);
  assert.deepEqual(read(path.join(first,'targets.json')).map(entry=>entry.url),[url]);
  const dir=path.join(first,'recovery');
  const before=read(path.join(dir,'checkpoint.json'));
  assert.equal(before.journalSha256,pinned.journalSha256);
  const {runAudit}=await import(pathToFileURL(path.resolve('scripts/full-sitemap-ssr-audit.mjs')));
  const title=pinned.title;
  const schema=JSON.stringify({'@type':'NewsArticle',headline:title,mainEntityOfPage:{'@id':url},
    author:{'@type':'Organization',name:'Marketrends.no'},isBasedOn:'https://example.invalid/'});
  const html=`<html><head><title>${title}</title><link rel="canonical" href="${url}">
    <meta property="og:url" content="${url}"><meta name="description" content="Offline fixture">
    <meta name="robots" content="index"><meta name="googlebot" content="index">
    <script type="application/ld+json">${schema}</script></head><body><main><article>
    <h1>${title}</h1><a href="https://example.invalid/">Offline fixture</a></article></main></body></html>`;
  const requests=[];
  const summary=await runAudit({origin:'http://127.0.0.1:3000',dir,resume:true,revision:REV,limit:1,
    fetcher:async input=>{
      requests.push(input);
      return new Response(html,{headers:{'content-type':'text/html'}});
    },now:()=>0,sleep:async()=>{}});
  assert.deepEqual(requests,['http://127.0.0.1:3000/'+pinned.slug]);
  verifySegmentSummary(summary,plan,1);
  assert.equal(summary.passed,pinned.prior+1);
  assert.equal(summary.failed,0);
  assert.equal(summary.untested,untested);
  const after=read(path.join(dir,'checkpoint.json'));
  assert.ok(after.journal.startsWith(before.journal));
  assert.equal(after.journal.trimEnd().split('\n').length,pinned.history+1);
  assert.equal(JSON.parse(after.journal.trimEnd().split('\n').at(-1)).url,url);

  // The next checkpoint must retain the historic extra attempt and the same baseline.
  const gate={status:'PASS',recoveryRevision:REV,snapshotSha256:SNAP,passed:pinned.prior+1,
    historyLength:pinned.history+1,releaseComplete:false,baselineArtifactId:pinned.id};
  const gateFile=path.join(first,'segment-gate.json');
  fs.writeFileSync(gateFile,JSON.stringify(gate));
  const next=path.join(temp,'next');
  const nextEnv={SEGMENT_SOURCE_DIR:first,SEGMENT_EVIDENCE:next,SEGMENT_SOURCE_ID:'991',
    SEGMENT_SOURCE_SHA:'a'.repeat(64),SEGMENT_PRIOR_PASSED:String(pinned.prior+1),SEGMENT_PRIOR_HISTORY:String(pinned.history+1)};
  assert.equal(prepare(nextEnv).status,0);
  assert.equal(read(path.join(next,'segment-plan.json')).baselineArtifactId,pinned.id);
  fs.writeFileSync(gateFile,JSON.stringify({...gate,baselineArtifactId:undefined}));
  assert.match(prepare({...nextEnv,SEGMENT_EVIDENCE:path.join(temp,'invalid')}).stderr,/SOURCE_COUNTS/);
});
