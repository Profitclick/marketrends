import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {batchSize,verifyResource,verifyTtfb,ttfbWindows,verifyProgress,reconcile,verifyReconciliation,makeLatch,guardedFetch,verifyTarget,Stop,REV,SNAP,RSS_MAX,LOCAL,MAX} from './segmented-recovery-guard.mjs';

const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(fn,code)=>assert.throws(fn,e=>e instanceof Stop&&e.code===code);
const base={memAvailableBytes:800,memTotalBytes:1000,hostOomKill:4,cgroupOom:2,cgroupOomKill:1,cgroup:'/runner'};
const worker={pid:123,startTicks:456,comm:'workerd',rssBytes:100*1024*1024};
const sample=over=>({...base,processes:[worker],...over});
const target=i=>({url:'https://marketrends.no/article-'+i,kind:'article',sitemap:'/sitemap-articles-1.xml'});
const options=()=>({redirect:'manual',signal:AbortSignal.timeout(15000)});
const rows=(n,ttfb)=>Array.from({length:n},()=>({ttfbMs:ttfb}));
test('batch cap and final partial batch; malformed input rejected',()=>{
  assert.equal(batchSize(250,3955),250);assert.equal(batchSize(250,205),205);
  for(const n of [0,-1,251,1.1,NaN,Infinity,'250'])fail(()=>batchSize(n,3955),'INVALID_BATCH_LIMIT');
  for(const n of [0,-1,5277,NaN])fail(()=>batchSize(250,n),'INVALID_REMAINING');
});
test('memory exactly at 20 percent passes; lower fails',()=>{
  assert.deepEqual(verifyResource(base,sample({memAvailableBytes:200})),['123:456']);
  fail(()=>verifyResource(base,sample({memAvailableBytes:199})),'SYSTEM_MEMORY_LOW');
});
test('any workerd above 512 MiB stops, boundary allowed',()=>{
  assert.deepEqual(verifyResource(base,sample({processes:[{...worker,rssBytes:RSS_MAX}]})),['123:456']);
  fail(()=>verifyResource(base,sample({processes:[worker,{...worker,pid:124,rssBytes:RSS_MAX+1}]})),'WORKER_RSS_LIMIT');
});
for(const key of ['hostOomKill','cgroupOom','cgroupOomKill']){
  test(key+' increment or reset stops',()=>{
    fail(()=>verifyResource(base,sample({[key]:base[key]+1})),'OOM_COUNTER_CHANGED');
    fail(()=>verifyResource(base,sample({[key]:base[key]-1})),'OOM_COUNTER_CHANGED');
  });
  test(key+' absent in baseline or sample fails closed',()=>{
    fail(()=>verifyResource({...base,[key]:null},sample()),'OOM_COUNTER_UNAVAILABLE');
    fail(()=>verifyResource(base,sample({[key]:null})),'OOM_COUNTER_UNAVAILABLE');
  });
}
test('missing and invalid system memory stops',()=>{
  for(const n of [null,undefined,-1,NaN,1001])fail(()=>verifyResource(base,sample({memAvailableBytes:n})),'SYSTEM_MEMORY_UNAVAILABLE');
  fail(()=>verifyResource(base,sample({memTotalBytes:2000})),'SYSTEM_MEMORY_CHANGED');
});
test('cgroup identity, worker disappearance/restart and missing RSS fail closed',()=>{
  fail(()=>verifyResource(base,sample({cgroup:'/other'})),'CGROUP_CHANGED');
  fail(()=>verifyResource(base,sample({processes:[]})),'WORKER_MISSING');
  fail(()=>verifyResource(base,sample({processes:[{...worker,rssBytes:null}]})),'WORKER_RSS_UNAVAILABLE');
  fail(()=>verifyResource(base,sample({processes:[{...worker,startTicks:457}]}),['123:456']),'WORKER_IDENTITY_CHANGED');
});
test('nearest-rank p95; two consecutive complete windows over 5000 stop',()=>{
  const a=rows(25,5001),b=rows(25,5001);
  verifyTtfb(a);verifyTtfb([...a,...rows(24,9999)]);
  fail(()=>verifyTtfb([...a,...b]),'TTFB_TWO_WINDOWS_LIMIT');
  verifyTtfb([...a,...rows(25,5000),...b]);
  assert.equal(ttfbWindows([...rows(23,1),...rows(2,6000)])[0].p95Ms,6000);
});
test('missing TTFB in a complete window stops rather than fabricating a value',()=>{
  fail(()=>verifyTtfb([...rows(24,500),{}]),'TTFB_WINDOW_EVIDENCE_MISSING');
});
test('runtime reconciliation exact URL, query, status, multiplicity',()=>{
  const r=[{url:'https://marketrends.no/a?q=1',status:200},{url:'https://marketrends.no/b',status:503}];
  const log='[wrangler:info] GET /a?q=1 200 OK (1ms)\n[wrangler:info] GET /b 503 Unavailable (1ms)\n';
  const good=reconcile(r,log);
  assert.deepEqual(good,{journalAttempts:2,journalHttpResponses:2,runtimeGetLines:2,matched:2,missing:0,extra:0});
  verifyReconciliation(good);
  for(const bad of [log.replace('q=1','q=2'),log.replace('503','200'),log+log,log.split('\n')[0]])fail(()=>verifyReconciliation(reconcile(r,bad)),'RUNTIME_LOG_DIVERGENCE');
  verifyReconciliation(reconcile([{url:r[0].url,status:null}],''));
  fail(()=>verifyReconciliation(reconcile([{url:r[0].url,status:null}],log)),'RUNTIME_LOG_DIVERGENCE');
});
test('network gate rejects foreign origin, wrong order, extra probes and altered fetch contract',()=>{
  const t=[target(1)];
  for(const u of ['https://marketrends.no/article-1',LOCAL+'/article-2',LOCAL+'/sitemap-index.xml'])fail(()=>verifyTarget(t,[],u,options()),'TARGET_ORDER_OR_ORIGIN');
  fail(()=>verifyTarget(t,[t[0].url],LOCAL+'/article-1',options()),'BATCH_CAP');
  for(const o of [{...options(),method:'POST'},{...options(),redirect:'follow'},{redirect:'manual'}])fail(()=>verifyTarget(t,[],LOCAL+'/article-1',o),'FETCH_CONTRACT');
  fail(()=>verifyTarget(Array.from({length:251},(_,i)=>target(i)),Array.from({length:250},(_,i)=>target(i).url),LOCAL+'/article-250',options()),'BATCH_CAP');
});
test('resource stop, TTFB stop, journal mismatch and missing evidence block native fetch and latch',async()=>{
  const blockers=[
    ()=>verifyResource(base,sample({memAvailableBytes:199})),
    ()=>verifyResource(base,sample({processes:[{...worker,rssBytes:RSS_MAX+1}]})),
    ()=>verifyResource(base,sample({hostOomKill:5})),
    ()=>verifyResource(base,sample({cgroupOom:3})),
    ()=>verifyResource(base,sample({cgroupOomKill:2})),
    ()=>verifyResource(base,sample({cgroupOom:null})),
    ()=>verifyTtfb(rows(50,5001)),
    ()=>verifyReconciliation(reconcile([{url:target(1).url,status:200}],'')),
    ()=>{throw Error('read failed');}
  ];
  for(const before of blockers){
    let sent=0,recorded=0,stops=0;
    const gate=makeLatch(()=>{stops++;}),t=[target(1)],started=[];
    const deps={gate,targets:t,started,before,record:()=>recorded++,nativeFetch:()=>{sent++;}};
    await assert.rejects(guardedFetch(deps,LOCAL+'/article-1',options()),Stop);
    await assert.rejects(guardedFetch({...deps,before:async()=>{}},LOCAL+'/article-1',options()),Stop);
    assert.equal(sent,0);assert.equal(recorded,0);assert.equal(started.length,0);assert.equal(stops,1);
  }
});
test('record failure stops before fetch; successful record precedes exactly one native call',async()=>{
  const t=[target(1)],started=[],events=[],gate=makeLatch(()=>{});
  const deps={gate,targets:t,started,before:()=>events.push('guard'),record:()=>events.push('record'),nativeFetch:()=>{events.push('fetch');return 'ok';}};
  assert.equal(await guardedFetch(deps,LOCAL+'/article-1',options()),'ok');
  assert.deepEqual(events,['guard','record','fetch']);
  await assert.rejects(guardedFetch(deps,LOCAL+'/article-1',options()),Stop);
  assert.equal(events.filter(x=>x==='fetch').length,1);
  let sent=0;
  await assert.rejects(guardedFetch({...deps,gate:makeLatch(()=>{}),started:[],record:()=>{throw Error('disk full');},nativeFetch:()=>sent++},LOCAL+'/article-1',options()),Stop);
  assert.equal(sent,0);
});
test('native error is not retried by supervisor and recorded start remains visible',async()=>{
  const t=[target(1)],started=[];let sent=0;
  const gate=makeLatch(()=>{});
  await assert.rejects(guardedFetch({gate,targets:t,started,before:()=>{},record:()=>{},nativeFetch:()=>{sent++;throw Error('network');}},LOCAL+'/article-1',options()),/network/);
  assert.equal(sent,1);assert.equal(started.length,1);assert.equal(gate.reason,null);
});
test('real source checkpoint: byte integrity, prefix, target ordering, incomplete start quarantine',()=>{
  const root=process.env.SEGMENT_TEST_SOURCE_DIR;
  assert.ok(root,'real artifact fixture required; do not skip');
  const raw=fs.readFileSync(path.join(root,'recovery/snapshot.json'));
  const state=JSON.parse(fs.readFileSync(path.join(root,'recovery/checkpoint.json'),'utf8'));
  assert.equal(hash(raw),SNAP);assert.equal(state.revision,REV);
  const snapshot=JSON.parse(raw),prior=new Set(state.journal.trimEnd().split('\n').map(l=>JSON.parse(l).url));
  const targets=snapshot.entries.filter(e=>!prior.has(e.url)).slice(0,MAX);
  assert.equal(targets.length,Math.min(MAX,snapshot.entries.length-prior.size));
  assert.ok(targets.length>=2,'at least two remaining URLs required for this fixture');
  assert.deepEqual(verifyProgress(raw,state,state,targets,[]),[]);
  fail(()=>verifyProgress(Buffer.from(raw.toString()+' '),state,state,targets,[]),'SNAPSHOT_INTEGRITY');
  fail(()=>verifyProgress(raw,{...state,revision:'wrong'},state,targets,[]),'CHECKPOINT_REVISION');
  fail(()=>verifyProgress(raw,{...state,journalSha256:'wrong'},state,targets,[]),'JOURNAL_INTEGRITY');
  const shortened=state.journal.slice(0,state.journal.indexOf('\n')+1);
  fail(()=>verifyProgress(raw,{...state,journal:shortened,journalSha256:hash(shortened)},state,targets,[]),'JOURNAL_PREFIX');
  fail(()=>verifyProgress(raw,state,state,targets,[targets[0].url]),'PROBE_JOURNAL_DIVERGENCE');
  assert.deepEqual(verifyProgress(raw,state,state,targets,[targets[0].url],true),[]);
  const row={...targets[0],status:200,ttfbMs:700,issues:[]};
  const j=state.journal+JSON.stringify(row)+'\n';
  const next={...state,journal:j,journalSha256:hash(j)};
  assert.equal(verifyProgress(raw,next,state,targets,[targets[0].url]).length,1);
  fail(()=>verifyProgress(raw,next,state,targets,[targets[1].url]),'PROBE_ORDER');
  const changed=state.journal+JSON.stringify({...row,url:targets[1].url})+'\n';
  fail(()=>verifyProgress(raw,{...state,journal:changed,journalSha256:hash(changed)},state,targets,[targets[0].url]),'JOURNAL_ORDER');
});
