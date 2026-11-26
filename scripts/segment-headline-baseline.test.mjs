import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';
import {headlinePreflight, HEADLINE_BASELINE, HEADLINE_URL} from './segment-headline-baseline.mjs';
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
  const first=path.join(temp,'first');
  const initialEnv={SEGMENT_SOURCE_DIR:artifact,SEGMENT_EVIDENCE:first,
    SEGMENT_SOURCE_ID:HEADLINE_BASELINE.id,SEGMENT_SOURCE_SHA:HEADLINE_BASELINE.sha256,
    SEGMENT_PRIOR_PASSED:'2971',SEGMENT_PRIOR_HISTORY:'2975'};
  const bad=prepare({...initialEnv,SEGMENT_SOURCE_SHA:'f'.repeat(64)});
  assert.equal(bad.status,70);
  assert.equal(fs.existsSync(first),false);
  const initial=prepare(initialEnv);
  assert.equal(initial.status,0,initial.stderr);
  const plan=read(path.join(first,'segment-plan.json'));
  assert.equal(plan.baselineArtifactId,HEADLINE_BASELINE.id);
  assert.deepEqual(read(path.join(first,'targets.json')).map(entry=>entry.url),[HEADLINE_URL]);
  const dir=path.join(first,'recovery');
  const before=read(path.join(dir,'checkpoint.json'));
  assert.equal(before.journalSha256,HEADLINE_BASELINE.journalSha256);
  const {runAudit}=await import(pathToFileURL(path.resolve('scripts/full-sitemap-ssr-audit.mjs')));
  const title=HEADLINE_BASELINE.title;
  const schema=JSON.stringify({'@type':'NewsArticle',headline:title,mainEntityOfPage:{'@id':HEADLINE_URL},
    author:{'@type':'Organization',name:'Marketrends.no'},isBasedOn:'https://example.invalid/'});
  const html=`<html><head><title>${title}</title><link rel="canonical" href="${HEADLINE_URL}">
    <meta property="og:url" content="${HEADLINE_URL}"><meta name="description" content="Offline fixture">
    <meta name="robots" content="index"><meta name="googlebot" content="index">
    <script type="application/ld+json">${schema}</script></head><body><main><article>
    <h1>${title}</h1><a href="https://example.invalid/">Offline fixture</a></article></main></body></html>`;
  const requests=[];
  const summary=await runAudit({origin:'http://127.0.0.1:3000',dir,resume:true,revision:REV,limit:1,
    fetcher:async input=>{
      requests.push(input);
      return new Response(html,{headers:{'content-type':'text/html'}});
    },now:()=>0,sleep:async()=>{}});
  assert.deepEqual(requests,['http://127.0.0.1:3000/'+HEADLINE_BASELINE.slug]);
  verifySegmentSummary(summary,plan,1);
  assert.equal(summary.passed,2972);
  assert.equal(summary.failed,0);
  assert.equal(summary.untested,2304);
  const after=read(path.join(dir,'checkpoint.json'));
  assert.ok(after.journal.startsWith(before.journal));
  assert.equal(after.journal.trimEnd().split('\n').length,2976);
  assert.equal(JSON.parse(after.journal.trimEnd().split('\n').at(-1)).url,HEADLINE_URL);

  // The next checkpoint must retain the historic extra attempt and the same baseline.
  const gate={status:'PASS',recoveryRevision:REV,snapshotSha256:SNAP,passed:2972,
    historyLength:2976,releaseComplete:false,baselineArtifactId:HEADLINE_BASELINE.id};
  const gateFile=path.join(first,'segment-gate.json');
  fs.writeFileSync(gateFile,JSON.stringify(gate));
  const next=path.join(temp,'next');
  const nextEnv={SEGMENT_SOURCE_DIR:first,SEGMENT_EVIDENCE:next,SEGMENT_SOURCE_ID:'991',
    SEGMENT_SOURCE_SHA:'a'.repeat(64),SEGMENT_PRIOR_PASSED:'2972',SEGMENT_PRIOR_HISTORY:'2976'};
  assert.equal(prepare(nextEnv).status,0);
  assert.equal(read(path.join(next,'segment-plan.json')).baselineArtifactId,HEADLINE_BASELINE.id);
  fs.writeFileSync(gateFile,JSON.stringify({...gate,baselineArtifactId:undefined}));
  assert.match(prepare({...nextEnv,SEGMENT_EVIDENCE:path.join(temp,'invalid')}).stderr,/SOURCE_COUNTS/);
});
