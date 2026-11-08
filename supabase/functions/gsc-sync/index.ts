import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {z} from 'npm:zod@3';
import {requireAdmin,unauthorized} from '../_shared/admin-auth.ts';
import {canonicalUrl,covers,TARGET,aggregate,recommend, type Metric} from '../_shared/gsc-metrics.ts';
const schema=z.object({action:z.enum(['sync','read','select']).default('read'),site_url:z.string().max(2048).optional(),days:z.number().int().min(1).max(90).default(7)});
const gateway='https://connector-gateway.lovable.dev/google_search_console';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
class ProviderError extends Error { constructor(public status:number,public details:string,public retryAfter:string|null){super(`[${status}]: ${details}`);} }
function checked<T>(r:{data:T;error:{message:string}|null}):T {if(r.error)throw new Error(r.error.message);return r.data;}
async function all(db:any,table:string,query:(q:any)=>any=(q)=>q) {
 const out:any[]=[];for(let from=0;;from+=1000){const batch=checked<any[]>(await query(db.from(table).select('*')).range(from,from+999));out.push(...batch);if(batch.length<1000)return out;}
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 const gate=await requireAdmin(req);if(!gate.ok)return unauthorized(corsHeaders);const db=gate.supabase;
 try{
  const parsed=schema.safeParse(await req.json().catch(()=>({})));if(!parsed.success)return json({error:parsed.error.flatten()},400);
  const input=parsed.data;
  const state=checked(await db.from('gsc_sync_state').select('*').eq('id',true).maybeSingle());
  if(input.action==='read')return json({state:state??{status:'NOT_SYNCED'},signals:await all(db,'search_performance_signals'),automatic_publishing:false});
  const key=Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY'),lovable=Deno.env.get('LOVABLE_API_KEY');
  if(!key||!lovable)return json({status:'GSC CREDENTIALS REQUIRED'},503);
  if(state?.retry_after && Date.parse(state.retry_after)>Date.now())return json({status:'RETRY_LATER',retry_after:state.retry_after},429);
  const call=async(path:string,body?:unknown)=>{
   const r=await fetch(gateway+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${lovable}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
   if(!r.ok)throw new ProviderError(r.status,await r.text(),r.headers.get('Retry-After'));return await r.json();
  };
  // Re-list and validate on EVERY refresh. No hardcoded property.
  const listed=await call('/webmasters/v3/sites');
  const candidates=(listed.siteEntry??[]).filter((s:any)=>s.permissionLevel!=='siteUnverifiedUser'&&covers(s.siteUrl,TARGET)).map((s:any)=>s.siteUrl);
  const chosen=input.site_url??state?.selected_site_url;
  if(chosen&&!candidates.includes(chosen))return json({error:'Selected property is not verified for this target'},403);
  if(!chosen && candidates.length!==1)return json({status:candidates.length?'selection_required':'NO_VERIFIED_PROPERTY',candidates},candidates.length?200:403);
  const site=chosen??candidates[0];
  if(input.action==='select'){checked(await db.from('gsc_sync_state').upsert({id:true,selected_site_url:site,status:'SELECTED'}));return json({status:'SELECTED',site_url:site});}
  // Google dates are Pacific reporting days; request final data with 3-day lag.
  const pacific=new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
  const end=new Date(pacific+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-3);
  const endDate=end.toISOString().slice(0,10);
  checked(await db.from('gsc_sync_state').upsert({id:true,selected_site_url:site,status:'SYNCING',last_started_at:new Date().toISOString(),error:null}));
  let rowsIngested=0;
  const days=state?.last_completed_at?input.days:90;
  const startDate=new Date(end.getTime()-(days-1)*86400000).toISOString().slice(0,10);
  for(const dataset of ['page','query']){
    const rowsByDay=new Map<string,any[]>();let truncated=false;
    for(let start=0;start<50000;start+=25000){
     const result=await call(`/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,{startDate,endDate,type:'web',dataState:'final',dimensions:dataset==='page'?['date','page']:['date','page','query'],aggregationType:'byPage',rowLimit:25000,startRow:start});
     for(const r of result.rows??[]){
      const canonical=canonicalUrl(r.keys[1]);if(!canonical)continue;
      if(![r.clicks,r.impressions,r.ctr,r.position].every(Number.isFinite)||r.clicks<0||r.impressions<0||r.ctr<0||r.ctr>1||r.position<0)throw new Error('Invalid Google metric values');
      const day=r.keys[0];
      const rows=rowsByDay.get(day)??[];
      rows.push({site_url:site,date:day,dataset,page:r.keys[1],canonical_url:canonical,query:dataset==='query'?r.keys[2]:'',clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position,search_type:'web',device:'',country:'',appearance:'',ingested_at:new Date().toISOString()});
      rowsByDay.set(day,rows);
     }
     if((result.rows??[]).length<25000)break;if(start===25000)truncated=true;
    }
    for(let offset=days-1;offset>=0;offset--){
    const date=new Date(end);date.setUTCDate(date.getUTCDate()-offset);const day=date.toISOString().slice(0,10);
    const rows=rowsByDay.get(day)??[];
    // Day replacement avoids stale rows when Google revises data. Done atomically by RPC.
    checked(await db.rpc('phase7c_replace_gsc_day',{p_site:site,p_date:day,p_dataset:dataset,p_rows:rows,p_status:truncated?'TRUNCATED':'FINAL'}));rowsIngested+=rows.length;
    }
  }
  const raw=await all(db,'gsc_daily_metrics',q=>q.eq('site_url',site).eq('dataset','page').gte('date',new Date(end.getTime()-179*86400000).toISOString().slice(0,10)).order('id'));
  const queryRows=await all(db,'gsc_daily_metrics',q=>q.eq('site_url',site).eq('dataset','query').gte('date',new Date(end.getTime()-89*86400000).toISOString().slice(0,10)).order('id'));
  const ingestion=await all(db,'gsc_ingestion_days',q=>q.eq('site_url',site).eq('dataset','page').order('date'));
  const completeDays=ingestion.filter(r=>r.status==='FINAL'&&r.date<=endDate&&r.date>=new Date(end.getTime()-55*86400000).toISOString().slice(0,10)).length;
  const urls=[...new Set(raw.map(r=>r.canonical_url))];let mappings:any={};
  for(let i=0;i<urls.length;i+=250)mappings={...mappings,...checked(await db.rpc('phase7c_map_urls',{p_urls:urls.slice(i,i+250)}))};
  const signals=urls.map(url=>{
   const metrics=aggregate(raw.filter(r=>r.canonical_url===url) as Metric[],endDate);
   const qs=queryRows.filter(r=>r.canonical_url===url);const totals=new Map<string,number>();for(const r of qs)totals.set(r.query,(totals.get(r.query)??0)+r.impressions);
   const top=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([query,impressions])=>({query,impressions}));
   const mapping=mappings[url]??{content_type:url.includes('/kategori/')?'category':'other',clusters:[],topics:[],entities:[]};
   return {canonical_url:url,content_type:mapping.content_type,mapping,metrics:{...metrics,query_count:totals.size,top_queries:top,query_rows_are_not_complete_inventory:true},recommendation:recommend(metrics,completeDays,top.map(q=>q.query),Boolean(mappings[url])),refreshed_at:new Date().toISOString()};
  });
  for(let i=0;i<signals.length;i+=250)checked(await db.from('search_performance_signals').upsert(signals.slice(i,i+250)));
  const clusterMetrics:any={};for(const slug of ['ai','krypto','fintech','startup','investering','daytrading']){
   const members=new Set(signals.filter(s=>(s.mapping.clusters??[]).includes(slug)).map(s=>s.canonical_url));
   clusterMetrics[slug]={...aggregate(raw.filter(r=>members.has(r.canonical_url)) as Metric[],endDate),pages:members.size};
  }
  const available=raw.map(r=>r.date).sort();
  const snapshot={state:available.length&&completeDays>=56?'MEASURED':'OBSERVATION_ONLY',complete_ingestion_days:completeDays,property:site,totals:available.length?aggregate(raw as Metric[],endDate):null,clusters:available.length?clusterMetrics:null,pages_with_impressions:signals.filter(s=>s.metrics.w90.impressions>0).length,ai_visibility:'NOT_EXPOSED_IN_THIS_WEB_DATASET',limitations:'Search Analytics returns top rows, omits anonymized queries; page and query datasets must never be summed. No AI visibility inferred. Empty results are not proof of no indexing.',synthetic_rows:0,auto_publishing:false};
  checked(await db.from('gsc_sync_state').upsert({id:true,selected_site_url:site,status:snapshot.state,last_completed_at:new Date().toISOString(),latest_complete_date:available.at(-1)??null,first_available_date:available[0]??null,error:null,retry_after:null,snapshot}));
  return json({ok:true,rows_ingested:rowsIngested,snapshot});
 }catch(e){
  const message=e instanceof Error?e.message:String(e);const retry=e instanceof ProviderError&&e.status===429?new Date(Date.now()+Math.max(60,Number(e.retryAfter)||3600)*1000).toISOString():null;
  await db.from('gsc_sync_state').upsert({id:true,status:e instanceof ProviderError&&e.status===403?'ACCESS_CONFIGURATION_ERROR':'SYNC_ERROR',error:message,retry_after:retry});
  return json({error:message,...(e instanceof ProviderError?{status:e.status,details:e.details,retry_after:retry}:{})},e instanceof ProviderError?e.status:500);
 }
});