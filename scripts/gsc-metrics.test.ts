import {test,expect} from 'bun:test';
import {canonicalUrl,aggregate,recommend,covers} from '../supabase/functions/_shared/gsc-metrics';
test('canonical normalizes only supported legacy clusters and origin',()=>{
  expect(canonicalUrl('http://www.marketrends.no/cluster/ai/')).toBe('https://marketrends.no/ai');
  expect(canonicalUrl('https://marketrends.no/cluster/unknown')).toBe('https://marketrends.no/cluster/unknown');
  expect(canonicalUrl('https://other.no/ai')).toBeNull();
  expect(canonicalUrl('https://marketrends.no/a?q=one')).toBe('https://marketrends.no/a?q=one');
});
test('CTR and position are weighted by actual impressions, not row averages',()=>{
  const r=aggregate([{date:'2026-11-05',canonical_url:'x',query:'',dataset:'page',impressions:100,clicks:10,ctr:0.1,position:2},{date:'2026-11-04',canonical_url:'x',query:'',dataset:'page',impressions:300,clicks:0,ctr:0,position:10}],'2026-11-05');
  expect(r.w28.ctr).toBe(0.025);expect(r.w28.position).toBe(8);expect(r.impression_delta_28d_vs_prior).toBeNull();
});
test('first 48h cannot trigger recommendations',()=>{
  const r=aggregate([{date:'2026-11-05',canonical_url:'x',query:'',dataset:'page',impressions:10000,clicks:0,ctr:0,position:10}],'2026-11-05');
  expect(recommend(r,2,['bitcoin'],true).state).toBe('OBSERVATION_ONLY');
  expect(recommend(r,2,['bitcoin'],true).action).toBe('NO_ACTION');
});
test('unmapped query cannot become a content gap',()=>{
  const r=aggregate(['2026-11-05','2026-10-05'].map(date=>({date,canonical_url:'x',query:'',dataset:'page',impressions:1000,clicks:100,ctr:0.1,position:10})),'2026-11-05');
  expect(recommend(r,56,['new query'],false).action).toBe('NO_ACTION');
});
test('verified property coverage is scheme/path sensitive except domains',()=>{
 expect(covers('sc-domain:marketrends.no')).toBe(true);expect(covers('https://marketrends.no/other/')).toBe(false);expect(covers('http://marketrends.no/')).toBe(false);
});