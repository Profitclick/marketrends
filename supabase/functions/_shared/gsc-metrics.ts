export const TARGET = 'https://marketrends.no/';
const clusters = new Set(['ai','krypto','fintech','startup','investering','daytrading']);
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['marketrends.no','www.marketrends.no'].includes(u.hostname) || !['http:','https:'].includes(u.protocol) || u.port) return null;
    let p = u.pathname.replace(/\/+$/, '') || '/';
    const legacy = p.match(/^\/cluster\/([^/]+)$/)?.[1];
    if (legacy && clusters.has(legacy)) p = '/' + legacy;
    // Preserve query parameters: there is no authority to merge distinct query URLs.
    return 'https://marketrends.no' + p + u.search;
  } catch { return null; }
}
export type Metric = {date:string;canonical_url:string;query:string;dataset:string;clicks:number;impressions:number;position:number;ctr:number};
export function aggregate(rows: Metric[], end: string) {
  const endMs = Date.parse(end + 'T00:00:00Z');
  const window = (days: number, offset = 0) => {
    const selected = rows.filter(r => {
      const age = (endMs-Date.parse(r.date+'T00:00:00Z'))/86400000;
      return age >= offset && age < days+offset;
    });
    const impressions = selected.reduce((n,r)=>n+r.impressions,0);
    const clicks = selected.reduce((n,r)=>n+r.clicks,0);
    return {impressions,clicks,ctr: impressions ? clicks/impressions : null,position:impressions ? selected.reduce((n,r)=>n+r.position*r.impressions,0)/impressions : null,days:new Set(selected.map(r=>r.date)).size};
  };
  const w3=window(3),w7=window(7),w28=window(28),w90=window(90),prior7=window(7,7),prior28=window(28,28);
  const delta = (a:number,b:number) => b>0 ? (a-b)/b : null;
  return {w3,w7,w28,w90,prior7,prior28,impression_delta_7d_vs_prior:delta(w7.impressions,prior7.impressions),impression_delta_28d_vs_prior:delta(w28.impressions,prior28.impressions),click_delta_28d_vs_prior:delta(w28.clicks,prior28.clicks),last_seen:rows.map(r=>r.date).sort().at(-1)??null};
}
// Conservative operational evidence policy, not an estimate of search demand:
// 56 complete ingestion days, >=100 current impressions and >=100 prior impressions.
// Wilson confidence intervals make snippet review depend on its own historical CTR.
function wilson(clicks:number,n:number) {
  const z=1.96,p=n?clicks/n:0,d=1+z*z/n;
  const center=(p+z*z/(2*n))/d,margin=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/d;
  return [center-margin,center+margin];
}
export function recommend(m: ReturnType<typeof aggregate>, completeDays:number, queries: string[], mapped:boolean) {
  const evidence={window:'28d vs prior 28d',end:m.last_seen,current:m.w28,comparison:m.prior28,queries};
  if(completeDays<56 || m.w28.impressions<100 || m.prior28.impressions<100) return {action:'NO_ACTION',state:'OBSERVATION_ONLY',confidence:'LOW',reason:'Insufficient complete reporting history or sample (policy: 56 days, 100 impressions per period)',evidence};
  if(!mapped) return {action:'NO_ACTION',state:'REVIEW_REQUIRED',confidence:'LOW',reason:'Canonical content mapping/coverage not verified; a new gap cannot be concluded',evidence};
  const current=wilson(m.w28.clicks,m.w28.impressions),prior=wilson(m.prior28.clicks,m.prior28.impressions);
  if(current[1]<prior[0]) return {action:'TITLE_SNIPPET_REVIEW',state:'MEASURED',confidence:'MEDIUM',reason:'Current CTR 95% interval below its own prior interval',evidence};
  if((m.impression_delta_28d_vs_prior??0)<-0.3 && (m.impression_delta_7d_vs_prior??0)<-0.3) return {action:'REFRESH_REVIEW',state:'MEASURED',confidence:'MEDIUM',reason:'Both comparable 7d and 28d impressions declined over 30%; cause unproven',evidence};
  if(m.w28.position!==null && m.w28.position>3 && m.w28.position<=20) return {action:'IMPROVE_EXISTING',state:'MEASURED',confidence:'MEDIUM',reason:'Existing page receives measured impressions at average position 3–20; intent fit requires editorial review',evidence};
  return {action:'NO_ACTION',state:'MEASURED',confidence:'MEDIUM',reason:'No supported change identified; related queries alone do not prove missing subtopics',evidence};
}
export function covers(site:string,target=TARGET) {
  const u=new URL(target);
  if(site.startsWith('sc-domain:')) {const d=site.slice(10).toLowerCase();return u.hostname===d||u.hostname.endsWith('.'+d);}
  try {return u.href.startsWith(new URL(site).href);}catch{return false;}
}