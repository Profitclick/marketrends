import {useEffect,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {FunctionsHttpError} from '@supabase/supabase-js';
import {Button} from '@/components/ui/button';
import {RefreshCw,Search} from 'lucide-react';
type Snapshot={state?:string;property?:string;pillars?:Record<string,{title:string;status:string;reason:string;coverage:{decision:string;reason:string;match?:{title:string}|null}}[]>;pages_with_impressions?:number;synthetic_rows?:number;totals?:{w28:{clicks:number;impressions:number;ctr:number|null;position:number|null}};limitations?:string;clusters?:Record<string,{w28:{clicks:number;impressions:number;ctr:number|null;position:number|null};pages:number}>};
type Signal={canonical_url:string;content_type:string;recommendation:{action:string;confidence:string;reason:string;evidence:unknown};metrics:{w28:{impressions:number;clicks:number};top_queries:{query:string;impressions:number}[]}};
type Result={state:{status:string;selected_site_url?:string;last_completed_at?:string;first_available_date?:string;latest_complete_date?:string;error?:string;snapshot?:Snapshot};signals:Signal[]};
export function GSCMeasuredPanel(){
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[candidates,setCandidates]=useState<string[]>([]);
 const run=async(action:'read'|'sync',site_url?:string)=>{
  setBusy(true);setError('');
  try{
   const response=await supabase.functions.invoke('gsc-sync',{body:{action,...(site_url?{site_url}:{})}});
   if(response.error)throw new Error(response.error instanceof FunctionsHttpError?await response.error.context.text():response.error.message);
   if(response.data.status==='selection_required'){setCandidates(response.data.candidates);return;}
   if(action==='read')setResult(response.data);else {
    const read=await supabase.functions.invoke('gsc-sync',{body:{action:'read'}});
    if(read.error)throw new Error(read.error instanceof FunctionsHttpError?await read.error.context.text():read.error.message);
    setCandidates([]);setResult(read.data);
   }
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 useEffect(()=>{void run('read');},[]);
 const snap=result?.state.snapshot;
 const value=(n:number|null|undefined)=>n===undefined||n===null?'—':n.toLocaleString('nb-NO',{maximumFractionDigits:2});
 return <section className="space-y-6 py-4" aria-label="Google Search Console målinger">
  <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
   <div><h2 className="font-serif text-2xl flex items-center gap-2"><Search className="h-5 w-5"/>Google Search Console</h2><p className="text-sm text-muted-foreground mt-2">{snap?.state??result?.state.status??'Laster…'} · {result?.state.selected_site_url??'Eiendom ikke valgt'}</p></div>
   <Button variant="outline" onClick={()=>void run('sync')} disabled={busy}><RefreshCw className={`h-4 w-4 mr-2 ${busy?'animate-spin':''}`}/>Hent målinger</Button>
  </header>
  {error&&<p role="alert" className="text-destructive break-words">{error}</p>}
  {result?.state.error&&<p role="alert" className="text-destructive break-words">{result.state.error}</p>}
  {candidates.length>0&&<fieldset className="space-y-2"><legend>Velg verifisert eiendom</legend>{candidates.map(c=><div key={c}><Button variant="outline" onClick={()=>void run('sync',c)} disabled={busy}>{c}</Button></div>)}</fieldset>}
  <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-b border-border pb-6">
   {[['Visninger · 28 dager',value(snap?.totals?.w28.impressions)],['Klikk · 28 dager',value(snap?.totals?.w28.clicks)],['CTR · 28 dager',snap?.totals?.w28.ctr!=null?value(snap.totals.w28.ctr*100)+' %':'—'],['Posisjon · 28 dager',value(snap?.totals?.w28.position)]].map(([label,v])=><div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-2xl font-semibold mt-2">{v}</dd></div>)}
  </dl>
  <p className="text-sm text-muted-foreground">Første måledag: {result?.state.first_available_date??'Ikke tilgjengelig'} · Siste komplette måledag med rader: {result?.state.latest_complete_date??'Ikke tilgjengelig'} · Sist hentet: {result?.state.last_completed_at?new Date(result.state.last_completed_at).toLocaleString('nb-NO'):'Aldri'}</p>
  {!snap?.totals&&<p className="border-l-2 border-border pl-4 text-muted-foreground">OBSERVATION_ONLY — Ingen tilgjengelige Google-målerader. Ingen konklusjon om indeksering, søketrafikk eller nye innholdsgap.</p>}
  {snap?.clusters&&<div className="overflow-x-auto"><h3 className="font-serif text-xl mb-3">Målte klynger</h3><table className="w-full text-sm text-left"><thead><tr>{['Klynge','Visninger 28d','Klikk 28d','CTR','Posisjon','Sider'].map(h=><th key={h} className="border-b border-border py-3 pr-4">{h}</th>)}</tr></thead><tbody>{Object.entries(snap.clusters).map(([slug,c])=><tr key={slug}><td className="py-3">{slug}</td><td>{value(c.w28.impressions)}</td><td>{value(c.w28.clicks)}</td><td>{c.w28.ctr===null?'—':value(c.w28.ctr*100)+' %'}</td><td>{value(c.w28.position)}</td><td>{c.pages}</td></tr>)}</tbody></table><p className="text-xs text-muted-foreground mt-3">Flere klyngemedlemskap gjør klyngetall ikke-additive.</p></div>}
  <div><h3 className="font-serif text-xl mb-3">Anbefalinger fra målinger</h3>{!result?.signals.length?<p className="text-muted-foreground">Ingen anbefalinger med tilstrekkelig målegrunnlag.</p>:result.signals.map(s=><details key={s.canonical_url} className="border-b border-border py-3"><summary className="cursor-pointer break-words">{s.recommendation.action} · {s.canonical_url} · {s.recommendation.confidence}</summary><p className="text-sm my-3">{s.recommendation.reason}</p><pre className="text-xs overflow-auto bg-muted p-3">{JSON.stringify(s.recommendation.evidence,null,2)}</pre></details>)}</div>
  {snap?.pillars&&<div><h3 className="font-serif text-xl mb-3">Pilaranalyse</h3>{Object.entries(snap.pillars).map(([cluster,items])=><div key={cluster} className="mb-5"><h4 className="font-semibold uppercase text-sm mb-2">{cluster}</h4>{items.map(p=><details key={p.title} className="border-b border-border py-2"><summary className="cursor-pointer">{p.title} · {p.status}</summary><p className="text-sm text-muted-foreground mt-2">{p.reason} · Dekning: {p.coverage.decision}. {p.coverage.match?.title??p.coverage.reason}</p></details>)}</div>)}</div>}
  <p className="text-xs text-muted-foreground">Kun Google Search Console-målinger. Interne trend- og autoritetspoeng inngår ikke i tallene. Anbefalinger publiserer ikke innhold automatisk.</p>
 </section>;
}