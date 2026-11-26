// MIGRATE-02.3A.7.4.2: bounded, fail-closed supervisor for the unchanged recovery evaluator.
// No network access except the explicitly authorized loopback fetch in live().
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkpointKey,QUARANTINE_RECOVERY,verifyReservation} from './segment-register.mjs';
import {checkApprovedBaseline,hasApprovedJournalPrefix,HEADLINE_BASELINE,HEADLINE_URL} from './segment-headline-baseline.mjs';
import {measureHttp} from './segment-http.mjs';
import {checkPulse,MAX_GAP_MS,monotonicMs,SAMPLE_INTERVAL_MS,supervise,watchChild} from './segment-watchdog.mjs';

export const REV='091837a1a5b1ed2be2c41fcba2d6032f2dfc3395';
export const SNAP='3e4cd3b4931f9918bf3136badf60c8a699435d212ca2abc0cf458c8b8f264d73';
export const INITIAL_ID='15049826258';
export const INITIAL_SHA='ab7879472ec1ead511b26e5817b842a77debcc57526c4fb86afeb5d91ce89671';
export const LOCAL='http://127.0.0.1:3000';
export const MAX=250, INVENTORY=5276, RSS_MAX=512*1024*1024, MEMORY_MIN=.20, WINDOW=25, P95_MAX=5000;
const hash=v=>createHash('sha256').update(v).digest('hex');
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export class Stop extends Error { constructor(code){super(code);this.name='GuardStop';this.code=code;} }
export const requireThat=(ok,code)=>{if(!ok)throw new Stop(code);};
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const atomic=(p,v)=>{const t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n');fs.renameSync(t,p);};
const lines=v=>{requireThat(typeof v==='string'&&(!v||v.endsWith('\n')),'JOURNAL_TRUNCATED');return v?v.trimEnd().split('\n').map(JSON.parse):[];};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const urlPath=url=>{const u=new URL(url);return u.pathname+u.search;};
const q=(values,percent)=>{const v=[...values].sort((a,b)=>a-b);return v.length?v[Math.ceil(v.length*percent)-1]:null;};
export function batchSize(requested,remaining){
  requireThat(Number.isSafeInteger(requested)&&requested>=1&&requested<=MAX,'INVALID_BATCH_LIMIT');
  requireThat(Number.isSafeInteger(remaining)&&remaining>=0&&remaining<=INVENTORY,'INVALID_REMAINING');
  return Math.min(requested,remaining);
}
export function verifyResource(base,sample,workerKeys=null){
  for(const x of [base,sample]){
    requireThat(integer(x.memAvailableBytes)&&integer(x.memTotalBytes)&&x.memTotalBytes>0&&x.memAvailableBytes<=x.memTotalBytes,'SYSTEM_MEMORY_UNAVAILABLE');
    requireThat(integer(x.hostOomKill)&&integer(x.cgroupOom)&&integer(x.cgroupOomKill),'OOM_COUNTER_UNAVAILABLE');
  }
  requireThat(sample.memTotalBytes===base.memTotalBytes,'SYSTEM_MEMORY_CHANGED');
  requireThat(sample.cgroup===base.cgroup&&typeof base.cgroup==='string','CGROUP_CHANGED');
  requireThat(sample.hostOomKill===base.hostOomKill&&sample.cgroupOom===base.cgroupOom&&sample.cgroupOomKill===base.cgroupOomKill,'OOM_COUNTER_CHANGED');
  requireThat(sample.memAvailableBytes/sample.memTotalBytes>=MEMORY_MIN,'SYSTEM_MEMORY_LOW');
  requireThat(Array.isArray(sample.processes),'PROCESS_EVIDENCE_MISSING');
  const workers=sample.processes.filter(p=>p.comm==='workerd');
  requireThat(workers.length>0,'WORKER_MISSING');
  requireThat(workers.every(p=>integer(p.rssBytes)&&integer(p.pid)&&integer(p.startTicks)),'WORKER_RSS_UNAVAILABLE');
  requireThat(workers.every(p=>p.rssBytes<=RSS_MAX),'WORKER_RSS_LIMIT');
  const keys=workers.map(p=>p.pid+':'+p.startTicks).sort();
  requireThat(workerKeys===null||equal(keys,workerKeys),'WORKER_IDENTITY_CHANGED');
  return keys;
}
export function verifyObservedResource(out,base,sample,previousKeys=null){
  try{
    return verifyResource(base,sample,previousKeys);
  }catch(error){
    atomic(path.join(out,'rejected-resource-sample.json'),{code:error.code,previousKeys,sample});
    throw error;
  }
}

export async function armStableWorkers({sample,record,now=monotonicMs,sleep=delay}){
  const started=now();
  let previous=started,stableSince=started,workerKeys=null;
  for(;;){
    const keys=sample();
    const measured=now();
    requireThat(measured>=previous&&measured-previous<MAX_GAP_MS,'STARTUP_TELEMETRY_GAP');
    requireThat(measured-started<=20000,'WORKER_STARTUP_UNSTABLE');
    if(!equal(keys,workerKeys))stableSince=measured;
    workerKeys=keys;
    record({monotonicMs:measured,workerKeys,stableForMs:measured-stableSince});
    if(measured-stableSince>=5000)return workerKeys;
    previous=measured;
    await sleep(SAMPLE_INTERVAL_MS);
  }
}
export function ttfbWindows(rows){
  const out=[];
  for(let i=0;i<rows.length;i+=WINDOW){
    const block=rows.slice(i,i+WINDOW), measured=block.map(r=>r.httpTtfbMs).filter(x=>Number.isFinite(x)&&x>=0);
    out.push({from:i+1,to:i+block.length,count:block.length,measured:measured.length,p95Ms:q(measured,.95),complete:block.length===WINDOW});
  }
  return out;
}
export function verifyTtfb(rows){
  let consecutive=0;
  for(const w of ttfbWindows(rows).filter(x=>x.complete)){
    requireThat(w.measured===WINDOW,'TTFB_WINDOW_EVIDENCE_MISSING');
    consecutive=w.p95Ms>P95_MAX?consecutive+1:0;
    requireThat(consecutive<2,'TTFB_TWO_WINDOWS_LIMIT');
  }
}
export function verifyProgress(snapshotRaw,state,original,targets,started,allowInFlight=false){
  requireThat(state.version===1&&state.revision===REV,'CHECKPOINT_REVISION');
  requireThat(hash(snapshotRaw)===SNAP&&state.snapshotSha256===SNAP,'SNAPSHOT_INTEGRITY');
  requireThat(typeof state.journal==='string'&&hash(state.journal)===state.journalSha256,'JOURNAL_INTEGRITY');
  requireThat(typeof original.journal==='string'&&hash(original.journal)===original.journalSha256&&state.journal.startsWith(original.journal),'JOURNAL_PREFIX');
  const rows=lines(state.journal.slice(original.journal.length));
  requireThat(rows.length<=targets.length&&started.length<=targets.length,'BATCH_CAP');
  requireThat(rows.length===started.length||(allowInFlight&&rows.length+1===started.length),'PROBE_JOURNAL_DIVERGENCE');
  requireThat(started.every((u,i)=>u===targets[i].url),'PROBE_ORDER');
  requireThat(rows.every((r,i)=>r.url===targets[i].url&&r.kind===targets[i].kind&&r.sitemap===targets[i].sitemap&&Array.isArray(r.issues)),'JOURNAL_ORDER');
  return rows;
}
export function verifyHttpTimings(rows,timings){
  requireThat(rows.length===timings.length,'HTTP_TIMING_COUNT');
  for(const [i,row] of rows.entries()){
    const t=timings[i];
    requireThat(t?.url===row.url&&t.status===row.status,'HTTP_TIMING_ORDER');
    requireThat([t.httpTtfbMs,t.guardOverheadMs,row.ttfbMs,row.totalMs].every(x=>Number.isFinite(x)&&x>=0),'HTTP_TIMING_MISSING');
  }
  verifyTtfb(timings);
}
export function reconcile(rows,raw){
  requireThat(typeof raw==='string','RUNTIME_LOG_MISSING');
  const expected=new Map(),observed=new Map();
  const add=(map,key)=>map.set(key,(map.get(key)||0)+1);
  for(const r of rows)if(r.status!==null)add(expected,JSON.stringify([urlPath(r.url),r.status]));
  for(const line of raw.replace(/\x1b\[[0-9;]*m/g,'').split('\n')){
    const m=line.match(/^\s*\[wrangler:info\]\s+GET\s+(\S+)\s+(\d{3})\b/);
    if(m)add(observed,JSON.stringify([urlPath(new URL(m[1],LOCAL)),Number(m[2])]));
  }
  let matched=0,missing=0,extra=0;
  for(const [k,n] of expected){const match=Math.min(n,observed.get(k)||0);matched+=match;missing+=n-match;}
  for(const [k,n] of observed)extra+=Math.max(0,n-(expected.get(k)||0));
  return {journalAttempts:rows.length,journalHttpResponses:[...expected.values()].reduce((a,b)=>a+b,0),runtimeGetLines:[...observed.values()].reduce((a,b)=>a+b,0),matched,missing,extra};
}
export function verifyReconciliation(report){
  requireThat(report.missing===0&&report.extra===0&&report.matched===report.journalHttpResponses,'RUNTIME_LOG_DIVERGENCE');
}
export function verifyTarget(targets,started,input,options){
  requireThat(started.length<targets.length&&started.length<MAX,'BATCH_CAP');
  const expected=new URL(targets[started.length].url);
  requireThat(expected.origin==='https://marketrends.no'&&expected.hash===''&&expected.username===''&&expected.password==='','TARGET_ORIGIN');
  requireThat(typeof input==='string'&&input===LOCAL+expected.pathname+expected.search,'TARGET_ORDER_OR_ORIGIN');
  requireThat((options?.method??'GET')==='GET'&&options?.redirect==='manual'&&options?.signal instanceof AbortSignal,'FETCH_CONTRACT');
}
export function makeLatch(onStop){
  let reason=null;
  return {get reason(){return reason;},stop(code){reason??=code;onStop(reason);throw new Stop(reason);},check(){if(reason)throw new Stop(reason);}};
}
export async function guardedFetch({gate,targets,started,before,record,nativeFetch},input,options){
  gate.check();
  try{
    verifyTarget(targets,started,input,options);
    await before();
    gate.check();
    verifyTarget(targets,started,input,options);
    options.signal.throwIfAborted();
    record(targets[started.length].url);
    started.push(targets[started.length].url);
  }catch(e){gate.stop(e instanceof Stop?e.code:'GUARD_EVIDENCE_UNAVAILABLE');}
  // Native fetch errors remain owned by the unchanged recovery evaluator.
  return nativeFetch(input,options);
}
function counters(file){return Object.fromEntries(fs.readFileSync(file,'utf8').trim().split('\n').map(line=>{const [k,v]=line.trim().split(/\s+/);return [k,Number(v)];}));}
function system(pid='self'){
  const mem=Object.fromEntries(fs.readFileSync('/proc/meminfo','utf8').split('\n').filter(l=>/^(MemTotal|MemAvailable):/.test(l)).map(l=>{const [key,v]=l.split(':');return [key,Number(v.trim().split(/\s+/)[0])*1024];}));
  const cg=fs.readFileSync('/proc/'+pid+'/cgroup','utf8').split('\n').find(l=>l.startsWith('0::'));
  requireThat(!!cg,'CGROUP_UNAVAILABLE');
  const cgroup=cg.slice(3);
  const dir=path.resolve('/sys/fs/cgroup','.'+cgroup);
  requireThat(dir==='/sys/fs/cgroup'||dir.startsWith('/sys/fs/cgroup/'),'CGROUP_PATH');
  const ev=counters(path.join(dir,'memory.events'));
  const vm=counters('/proc/vmstat');
  return {memAvailableBytes:mem.MemAvailable,memTotalBytes:mem.MemTotal,hostOomKill:vm.oom_kill,cgroupOom:ev.oom,cgroupOomKill:ev.oom_kill,cgroup};
}
function resourceReader(group){
  const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}).trim());
  const page=Number(execFileSync('getconf',['PAGESIZE'],{encoding:'utf8'}).trim());
  requireThat(hz>0&&page>0,'PROC_UNITS');
  const prev=new Map();
  return (phase,source)=>{
    const now=performance.now()/1000, processes=[];
    for(const name of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){
      let raw;try{raw=fs.readFileSync('/proc/'+name+'/stat','utf8');}catch(e){if(e.code==='ENOENT'||e.code==='ESRCH')continue;throw e;}
      const end=raw.lastIndexOf(')'),f=raw.slice(end+2).split(/\s+/);
      if(Number(f[2])!==group)continue;
      const pid=Number(name),comm=raw.slice(raw.indexOf('(')+1,end),ticks=Number(f[11])+Number(f[12]),startTicks=Number(f[19]),rssBytes=Number(f[21])*page;
      requireThat(integer(ticks)&&integer(startTicks)&&integer(rssBytes),'PROCESS_STAT_INVALID');
      const key=pid+':'+startTicks,old=prev.get(key);
      const cpuDeltaPct=old&&now>old.now?100*(ticks-old.ticks)/hz/(now-old.now):null;
      requireThat(cpuDeltaPct===null||(Number.isFinite(cpuDeltaPct)&&cpuDeltaPct>=0),'CPU_COUNTER_CHANGED');
      prev.set(key,{now,ticks});
      processes.push({pid,comm,startTicks,rssBytes,cpuTicks:ticks,cpuDeltaPct});
    }
    requireThat(processes.some(p=>p.pid===group),'RUNTIME_LEADER_MISSING');
    return {epoch:Date.now()/1000,monotonic:now,phase,source,processes,...system(group)};
  };
}
async function modules(){
  const root=process.cwd();
  const checkpoint=await import(pathToFileURL(path.join(root,'scripts/full-sitemap-checkpoint.mjs')).href);
  const audit=await import(pathToFileURL(path.join(root,'scripts/full-sitemap-ssr-audit.mjs')).href);
  requireThat(checkpoint.auditRevision(true)===REV,'RECOVERY_CHECKOUT');
  return {...checkpoint,...audit};
}
export function verifyZeroProbeQuarantine(source,quarantine,plan){
  const approval=QUARANTINE_RECOVERY;
  requireThat(plan.sourceId===approval.sourceId&&plan.sourceSha===approval.sourceSha&&
    checkpointKey(plan)===approval.key,'QUARANTINE_SOURCE_PIN');
  const gate=json(path.join(quarantine,'segment-gate.json'));
  requireThat(equal(gate,json(path.join(quarantine,'guard-stop.json')))&&gate.status==='QUARANTINE'&&
    gate.code==='WORKER_IDENTITY_CHANGED'&&gate.phase==='active'&&gate.started===0&&gate.resumeAllowed===false&&
    gate.recoveryRevision===REV,'QUARANTINE_GATE');
  const failedPlan=json(path.join(quarantine,'segment-plan.json'));
  requireThat(failedPlan.sourceId===plan.sourceId&&failedPlan.sourceSha===plan.sourceSha&&
    failedPlan.prior===plan.prior&&failedPlan.historyCount===plan.historyCount&&failedPlan.limit===50&&
    checkpointKey(failedPlan)===approval.key,'QUARANTINE_PLAN');
  const reservation=json(path.join(quarantine,'segment-reservation.json'));
  verifyReservation(failedPlan,approval.run,reservation);
  for(const file of ['probe-starts.jsonl','http-timings.jsonl']){
    const evidence=path.join(quarantine,file);
    requireThat(!fs.existsSync(evidence)||fs.statSync(evidence).size===0,'QUARANTINE_PROBE_EVIDENCE');
  }
  for(const file of ['snapshot.json','checkpoint.json','attempt-history.jsonl','results.jsonl']){
    requireThat(fs.readFileSync(path.join(source,'recovery',file)).equals(
      fs.readFileSync(path.join(quarantine,'recovery',file))),'QUARANTINE_CHECKPOINT_CHANGED');
  }
  const runtime=fs.readFileSync(path.join(quarantine,'runtime.log'),'utf8');
  const reconciliation=json(path.join(quarantine,'runtime-reconciliation.json'));
  requireThat(!/\[wrangler:info\]\s+GET\s/m.test(runtime)&&
    ['journalAttempts','journalHttpResponses','runtimeGetLines','matched','missing','extra']
      .every(key=>reconciliation[key]===0),'QUARANTINE_RUNTIME_GET');
  return {status:'VERIFIED_ZERO_PROBES',quarantineCommit:approval.terminalCommit,
    artifactId:approval.artifactId,artifactSha256:approval.artifactSha};
}
async function prepare(){
  const {openCheckpoint}=await modules();
  const source=process.env.SEGMENT_SOURCE_DIR,out=process.env.SEGMENT_EVIDENCE;
  const sourceId=process.env.SEGMENT_SOURCE_ID,sourceSha=process.env.SEGMENT_SOURCE_SHA;
  const prior=Number(process.env.SEGMENT_PRIOR_PASSED),historyCount=Number(process.env.SEGMENT_PRIOR_HISTORY);
  requireThat(integer(prior)&&prior>=1321&&prior<=INVENTORY&&integer(historyCount),'SOURCE_COUNTS');
  requireThat(/^\d+$/.test(sourceId)&&/^[a-f0-9]{64}$/.test(sourceSha),'SOURCE_IDENTITY');
  requireThat(!fs.existsSync(path.join(source,'guard-stop.json')),'SOURCE_QUARANTINED');
  const approvedSource=sourceId===HEADLINE_BASELINE.id;
  let baselineArtifactId;
  if(sourceId===INITIAL_ID){
    requireThat(sourceSha===INITIAL_SHA&&prior===1321&&historyCount===1324,'INITIAL_SOURCE_PIN');
  }else if(approvedSource){
    baselineArtifactId=HEADLINE_BASELINE.id;
  }else{
    const gate=json(path.join(source,'segment-gate.json'));
    requireThat(gate.status==='PASS'&&gate.recoveryRevision===REV&&gate.snapshotSha256===SNAP&&gate.passed===prior&&gate.historyLength===historyCount&&gate.releaseComplete===(prior===INVENTORY),'SOURCE_GATE_NOT_PASS');
    baselineArtifactId=gate.baselineArtifactId;
  }
  requireThat(baselineArtifactId===undefined||baselineArtifactId===HEADLINE_BASELINE.id,'SOURCE_BASELINE_LINEAGE');
  requireThat(historyCount===prior+(baselineArtifactId===undefined?3:4),'SOURCE_COUNTS');
  const dir=path.join(source,'recovery'),state=json(path.join(dir,'checkpoint.json'));
  const raw=fs.readFileSync(path.join(dir,'snapshot.json'));
  requireThat(hash(raw)===SNAP&&state.snapshotSha256===SNAP&&hash(state.journal)===state.journalSha256&&state.revision===REV,'SOURCE_CHECKPOINT_INTEGRITY');
  requireThat(fs.readFileSync(path.join(dir,'attempt-history.jsonl'),'utf8')===state.journal&&lines(state.journal).length===historyCount,'SOURCE_HISTORY');
  requireThat(!fs.existsSync(path.join(dir,'audit.lock')),'SOURCE_LOCKED');
  const limit=batchSize(Number(process.env.SEGMENT_LIMIT),INVENTORY-prior);
  const c=openCheckpoint({dir,resume:true,revision:REV,limit:Math.max(1,limit)});
  const latest=c.latest();
  const failures=latest.filter(r=>r.status!==200||r.issues.length);
  const unresolved=approvedSource?1:0;
  requireThat(c.snapshot.entries.length===INVENTORY&&latest.length===prior+unresolved&&failures.length===unresolved,'SOURCE_RESULTS');
  if(approvedSource){
    const [repair]=failures;
    requireThat(repair.url===HEADLINE_URL&&repair.status===200&&equal(repair.issues,['ARTICLE_HEADLINE_MISMATCH'])&&
      c.pending[0]?.url===HEADLINE_URL,'SOURCE_HEADLINE_RESULT');
  }
  requireThat(equal(lines(fs.readFileSync(path.join(dir,'results.jsonl'),'utf8')),c.latest()),'SOURCE_EXPORT_DIVERGENCE');
  const oldSummary=json(path.join(dir,'summary.json'));
  requireThat(oldSummary.revision===REV&&oldSummary.complete===(prior===INVENTORY)&&oldSummary.passed===prior&&oldSummary.failed===unresolved&&oldSummary.untested===INVENTORY-prior-unresolved,'SOURCE_SUMMARY');
  const passed=new Set(latest.filter(r=>r.status===200&&!r.issues.length).map(r=>r.url));
  requireThat(c.pending.length===limit&&c.pending.every(r=>r.kind==='article'&&!passed.has(r.url)),'SOURCE_TARGETS');
  const plan={sourceId,sourceSha,prior,historyCount,limit,snapshotSha256:SNAP,recoveryRevision:REV,sourceJournalSha256:state.journalSha256};
  if(baselineArtifactId!==undefined){
    requireThat(hasApprovedJournalPrefix(state.journal)&&(!approvedSource?prior>HEADLINE_BASELINE.prior:true),'SOURCE_BASELINE_JOURNAL');
    plan.baselineArtifactId=baselineArtifactId;
  }
  if(approvedSource){
    checkApprovedBaseline(plan,json(path.join(source,'baseline-approval.json')),checkpointKey(plan));
  }
  const quarantine=process.env.SEGMENT_QUARANTINE_DIR;
  const priorStop=quarantine?verifyZeroProbeQuarantine(source,quarantine,plan):null;
  if(priorStop){
    plan.quarantineCommit=priorStop.quarantineCommit;
    checkpointKey(plan);
  }
  fs.mkdirSync(out,{recursive:true});
  requireThat(!fs.existsSync(path.join(out,'recovery')),'OUTPUT_EXISTS');
  fs.cpSync(dir,path.join(out,'recovery'),{recursive:true,errorOnExist:true});
  atomic(path.join(out,'targets.json'),c.pending);
  if(priorStop)atomic(path.join(out,'quarantine-continuation.json'),priorStop);
  atomic(path.join(out,'segment-plan.json'),plan);
  console.log(JSON.stringify({prior,historyCount,limit,recoveryRevision:REV}));
}
function baseline(){
  const s=system();
  requireThat(integer(s.memTotalBytes)&&s.memTotalBytes>0&&integer(s.memAvailableBytes)&&s.memAvailableBytes/s.memTotalBytes>=MEMORY_MIN,'BASELINE_MEMORY');
  requireThat(integer(s.hostOomKill)&&integer(s.cgroupOom)&&integer(s.cgroupOomKill),'BASELINE_OOM_UNAVAILABLE');
  atomic(path.join(process.env.SEGMENT_EVIDENCE,'baseline-resources.json'),s);
}
async function completeInventory(){
  const out=process.env.SEGMENT_EVIDENCE;
  const plan=json(path.join(out,'segment-plan.json'));
  const targets=json(path.join(out,'targets.json'));
  requireThat(plan.prior===INVENTORY&&plan.limit===0&&equal(targets,[]),'INVENTORY_NOT_COMPLETE');
  const dir=path.join(out,'recovery'),state=json(path.join(dir,'checkpoint.json'));
  const {openCheckpoint}=await modules();
  const c=openCheckpoint({dir,resume:true,revision:REV,limit:1});
  requireThat(state.snapshotSha256===SNAP&&state.journalSha256===plan.sourceJournalSha256&&
    lines(state.journal).length===plan.historyCount&&c.snapshot.entries.length===INVENTORY&&
    c.pending.length===0&&c.latest().length===INVENTORY&&c.latest().every(r=>r.status===200&&!r.issues.length),
  'INVENTORY_NOT_COMPLETE');
  atomic(path.join(out,'segment-gate.json'),{status:'PASS',recoveryRevision:REV,snapshotSha256:SNAP,
    passed:plan.prior,historyLength:plan.historyCount,batchAttempted:0,releaseComplete:true,
    sourceArtifactId:plan.sourceId,sourceSha256:plan.sourceSha,
    ...(plan.baselineArtifactId===undefined?{}:{baselineArtifactId:plan.baselineArtifactId})});
}
async function live(){
  const out=process.env.SEGMENT_EVIDENCE;
  const plan=json(path.join(out,'segment-plan.json'));
  verifyReservation(plan,process.env.GITHUB_RUN_ID,json(path.join(out,'segment-reservation.json')));
  // Keep the output directory single-use even if the guard is restarted directly.
  fs.closeSync(fs.openSync(path.join(out,'segment-launch.lock'),'wx'));
  const group=Number(process.env.SEGMENT_RUNTIME_PGID);
  requireThat(Number.isSafeInteger(group)&&group>1&&group!==process.pid,'RUNTIME_PGID');
  const base=json(path.join(out,'baseline-resources.json'));
  const reader=resourceReader(group);
  let workerKeys=null;
  await supervise({entry:fileURLToPath(import.meta.url),args:['audit-child'],out,revision:REV,
    async arm(){
      workerKeys=await armStableWorkers({
        sample:()=>verifyObservedResource(out,base,reader('startup','readiness')),
        record:evidence=>fs.appendFileSync(path.join(out,'worker-readiness.jsonl'),JSON.stringify(evidence)+'\n')
      });
    },
    sample(phase,source){
      const sample=reader(phase,source);
      verifyObservedResource(out,base,sample,workerKeys);
      return sample;
    },
    stopRuntime(){
      try{process.kill(-group,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
    }
  });
}
export function verifyBaselineFirstResult(plan,rows){
  if(plan.sourceId===HEADLINE_BASELINE.id&&rows.length>0){
    requireThat(rows[0].url===HEADLINE_URL&&rows[0].status===200&&!rows[0].issues.length,'BASELINE_HEADLINE_STILL_FAILING');
  }
}

export function verifySegmentSummary(summary,plan,attempted){
  const priorAttempted=plan.prior+(plan.sourceId===HEADLINE_BASELINE.id?1:0);
  requireThat(summary.batchAttempted===attempted&&summary.priorAttempted===priorAttempted&&
    summary.attempted===plan.prior+attempted&&summary.snapshotUrls===INVENTORY,'FINAL_SUMMARY_DIVERGENCE');
}

export async function auditChild(transport=measureHttp){
  requireThat(process.connected,'WATCHDOG_REQUIRED');
  const out=process.env.SEGMENT_EVIDENCE,dir=path.join(out,'recovery');
  const started=[],timings=[];
  const gate=makeLatch(code=>{
    try{atomic(path.join(out,'guard-child-stop.json'),{code,started:started.length});}
    finally{process.exit(70);}
  });
  const watchdog=watchChild(code=>gate.stop(code));
  const checked=fn=>{try{return fn();}catch(e){return gate.stop(e instanceof Stop?e.code:'GUARD_EVIDENCE_UNAVAILABLE');}};
  try{
    const plan=json(path.join(out,'segment-plan.json')),targets=json(path.join(out,'targets.json'));
    verifyReservation(plan,process.env.GITHUB_RUN_ID,json(path.join(out,'segment-reservation.json')));
    requireThat(fs.existsSync(path.join(out,'segment-launch.lock')),'SEGMENT_LAUNCH_REQUIRED');
    const source=process.env.SEGMENT_SOURCE_DIR,rawLog=process.env.SEGMENT_RAW_LOG;
    const original=json(path.join(source,'recovery/checkpoint.json'));
    const {runAudit,openCheckpoint}=await modules();
    let lastStart=-Infinity;
    const progress=()=>checked(()=>{
      const rows=verifyProgress(fs.readFileSync(path.join(dir,'snapshot.json')),json(path.join(dir,'checkpoint.json')),original,targets,started);
      const file=path.join(out,'http-timings.jsonl');
      const persisted=fs.existsSync(file)?lines(fs.readFileSync(file,'utf8')):[];
      requireThat(equal(persisted,timings),'HTTP_TIMING_EVIDENCE_DIVERGENCE');
      verifyHttpTimings(rows,persisted);
      verifyBaselineFirstResult(plan,rows);
      return rows;
    });
    async function checkLog(rows){
      const deadline=performance.now()+2000;
      for(;;){
        const r=checked(()=>reconcile(rows,fs.readFileSync(rawLog,'utf8')));
        atomic(path.join(out,'runtime-reconciliation.json'),r);
        if(r.extra||!r.missing){checked(()=>verifyReconciliation(r));return;}
        if(performance.now()>=deadline)gate.stop('RUNTIME_LOG_DIVERGENCE');
        await delay(100);
      }
    }
    requireThat(plan.sourceJournalSha256===original.journalSha256,'PLAN_SOURCE_CHANGED');
    requireThat(plan.limit>0&&targets.length===plan.limit&&batchSize(plan.limit,INVENTORY-plan.prior)===plan.limit,'PLAN_CAP');
    requireThat(equal(targets,openCheckpoint({dir,resume:true,revision:REV,limit:plan.limit}).pending),'PLAN_CHANGED');
    const fetcher=(input,options)=>{
      const entered=performance.now();
      return guardedFetch({gate,targets,started,
        before:async()=>{
          const rows=progress();
          await checkLog(rows);
          const wait=1000-(performance.now()-lastStart);
          if(wait>0)await delay(wait);
          await watchdog.sample('pre-probe');
        },
        record:url=>{
          const f=fs.openSync(path.join(out,'probe-starts.jsonl'),'a');
          try{fs.writeSync(f,JSON.stringify({url,startedAt:new Date().toISOString(),monotonicMs:performance.now()})+'\n');fs.fsyncSync(f);}finally{fs.closeSync(f);}
        },
        nativeFetch:async(input,options)=>{
          try{watchdog.assertFresh();}catch(error){gate.stop(error.code);}
          if(options.signal.aborted)gate.stop('PROBE_EXPIRED_BEFORE_HTTP');
          lastStart=performance.now();
          const {response,httpTtfbMs,dispatched}=await transport(input,options);
          const timing={url:started.at(-1),status:response.status,httpTtfbMs,guardOverheadMs:dispatched-entered};
          checked(()=>fs.appendFileSync(path.join(out,'http-timings.jsonl'),JSON.stringify(timing)+'\n'));
          timings.push(timing);
          return response;
        }},input,options);
    };
    const summary=await runAudit({origin:LOCAL,dir,resume:true,revision:REV,limit:plan.limit,fetcher});
    const rows=progress();
    await checkLog(rows);
    const passiveStart=performance.now()/1000;
    atomic(path.join(out,'passive-start.json'),{monotonic:passiveStart});
    await watchdog.sample('passive-start');
    await delay(120000);
    await watchdog.sample('passive-end');
    const passiveEnd=performance.now()/1000;
    atomic(path.join(out,'passive-end.json'),{monotonic:passiveEnd});
    await checkLog(rows);
    const state=json(path.join(dir,'checkpoint.json')),c=openCheckpoint({dir,resume:true,revision:REV,limit:1});
    requireThat(equal(lines(fs.readFileSync(path.join(dir,'results.jsonl'),'utf8')),c.latest())&&fs.readFileSync(path.join(dir,'attempt-history.jsonl'),'utf8')===state.journal,'FINAL_EXPORT_DIVERGENCE');
    verifySegmentSummary(summary,plan,rows.length);
    const samples=lines(fs.readFileSync(path.join(out,'runtime-resources.jsonl'),'utf8'));
    let previous;
    for(const {telemetry} of samples){
      checkPulse(telemetry,previous,telemetry?.at);
      previous=telemetry;
    }
    const idle=samples.filter(x=>x.phase==='passive');
    requireThat(passiveEnd-passiveStart>=120&&idle.length>=2&&idle.at(-1).monotonic-idle[0].monotonic>=119,'PASSIVE_EVIDENCE');
    const values=timings.map(r=>r.httpTtfbMs);
    const stats={attempted:rows.length,passed:rows.filter(r=>!r.issues.length).length,failed:rows.filter(r=>r.issues.length).length,
      httpTtfbP50Ms:q(values,.5),httpTtfbP95Ms:q(values,.95),httpTtfbMaxMs:values.length?Math.max(...values):null,
      httpTtfbWindows:ttfbWindows(timings),guardOverheadP95Ms:q(timings.map(t=>t.guardOverheadMs),.95),
      evaluatorTtfbP95Ms:q(rows.map(r=>r.ttfbMs),.95),evaluatorTotalP95Ms:q(rows.map(r=>r.totalMs),.95),
      activeSamples:samples.filter(s=>s.phase==='active').length,passiveSamples:idle.length,passiveSeconds:passiveEnd-passiveStart,
      telemetryMaxGapMs:MAX_GAP_MS,summary};
    atomic(path.join(out,'diagnostic-results.json'),stats);
    console.log(JSON.stringify(stats));
    requireThat(rows.length===plan.limit&&stats.failed===0&&summary.failed===0&&summary.passed===plan.prior+rows.length&&summary.transients===0&&summary.complete===(summary.passed===INVENTORY),'SEGMENT_NOT_PASS');
    atomic(path.join(out,'segment-result.json'),{status:'PASS',recoveryRevision:REV,snapshotSha256:SNAP,passed:summary.passed,
      historyLength:lines(state.journal).length,sourceArtifactId:plan.sourceId,sourceSha256:plan.sourceSha,batchAttempted:rows.length,
      releaseComplete:summary.complete,sourceCheckpointKey:checkpointKey(plan),registerRunId:process.env.GITHUB_RUN_ID,
      ...(plan.baselineArtifactId===undefined?{}:{baselineArtifactId:plan.baselineArtifactId})});
    watchdog.assertFresh();
    watchdog.close();
    process.exit(0);
  }catch(e){gate.stop(e.code??'AUDIT_OR_EVIDENCE_FAILURE');}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const command=process.argv[2];
  try{
    if(command==='prepare')await prepare();
    else if(command==='baseline')baseline();
    else if(command==='complete-inventory')await completeInventory();
    else if(command==='audit-child')await auditChild();
    else if(command==='live')await live();
    else throw new Stop('UNKNOWN_COMMAND');
  }catch(e){console.error('SEGMENT PRECONDITION '+(e instanceof Stop?e.code:'EVIDENCE_OR_EXECUTION_FAILURE'));process.exitCode=70;}
}
