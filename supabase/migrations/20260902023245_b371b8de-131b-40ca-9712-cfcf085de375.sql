
-- Phase 6.2E: entity/topic governance, deterministic (no-AI) pre-pass, hygiene classification.

-- 1. Queue classification column -------------------------------------------
alter table public.articles
  add column if not exists enrich_class text
    check (enrich_class in ('deterministic_complete','hybrid_pending','ai_required','complete_no_relations')),
  add column if not exists deterministic_pass_at timestamptz;

create index if not exists idx_articles_enrich_class on public.articles(enrich_class);

-- 2. Stop-terms: generic vocabulary that must never anchor a graph relation --
create table if not exists public.graph_stopterms (term text primary key);
alter table public.graph_stopterms enable row level security;
grant select on public.graph_stopterms to authenticated;
grant all on public.graph_stopterms to service_role;
drop policy if exists "admins manage stopterms" on public.graph_stopterms;
create policy "admins manage stopterms" on public.graph_stopterms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.graph_stopterms(term) values
 ('marked'),('markedet'),('selskap'),('selskapet'),('bank'),('banken'),('kunde'),('kunder'),
 ('teknologi'),('plattform'),('plattformen'),('tjeneste'),('tjenester'),('produkt'),('produkter'),
 ('nyheter'),('analyse'),('rapport'),('rapporten'),('vekst'),('krise'),('avtale'),('kurs'),
 ('aksje'),('aksjer'),('fond'),('rente'),('renter'),('valuta'),('krypto'),('data'),('app'),
 ('norge'),('norsk'),('norske'),('europa'),('verden'),('staten'),('regjeringen'),('bransjen'),
 ('investor'),('investorer'),('gruppen'),('konsernet'),('styret'),('sjefen'),('direktor'),
 ('open'),('meta'),('core'),('next'),('link'),('flow'),('base'),('name'),('pool'),('cash'),
 ('group'),('holding'),('capital'),('partner'),('partners'),('global'),('digital'),('finans')
on conflict do nothing;

-- 3. Deterministic (zero-AI) enrichment pre-pass -----------------------------
-- Creates ONLY relations to existing canonical nodes. Never creates nodes.
create or replace function public.deterministic_enrich_batch(_limit int default 400)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  txt text;
  ents int; tops int; rej int;
  r_inspected int := 0; r_with_ent int := 0; r_with_top int := 0;
  r_rel int := 0; r_rejected int := 0;
  r_a int := 0; r_b int := 0; r_c int := 0; r_d int := 0;
  cls text;
begin
  for a in
    select id, title, coalesce(content,'') as content
    from articles
    where published
      and enrichment_status in ('pending','retry')
      and enrich_class is null
    order by enrich_priority desc nulls last, created_at desc
    limit _limit
  loop
    r_inspected := r_inspected + 1;
    txt := lower(a.title || ' ' || left(a.content, 20000));

    -- entities: canonical name or alias, word-boundary match, not a stop-term
    with cand as (
      select e.id,
             count(*) filter (where true) as hits,
             max(char_length(t.term)) as tlen
      from entities e
      cross join lateral unnest(array[e.name] || coalesce(e.aliases, '{}'::text[])) as t(term)
      where char_length(t.term) >= 4
        and strpos(txt, lower(t.term)) > 0
        and lower(t.term) not in (select term from graph_stopterms)
        and txt ~ ('(^|[^a-z0-9æøå])' ||
                   regexp_replace(lower(t.term), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                   '([^a-z0-9æøå]|$)')
      group by e.id
    )
    insert into article_entities(article_id, entity_id, mention_count, is_primary)
    select a.id, c.id, 1, false from cand c
    on conflict (article_id, entity_id) do nothing;
    get diagnostics ents = row_count;

    -- rejected: substring hits that failed the stop-term/boundary discipline
    select count(*) into rej
    from entities e
    cross join lateral unnest(array[e.name] || coalesce(e.aliases, '{}'::text[])) as t(term)
    where char_length(t.term) >= 3
      and strpos(txt, lower(t.term)) > 0
      and (lower(t.term) in (select term from graph_stopterms)
        or char_length(t.term) < 4
        or txt !~ ('(^|[^a-z0-9æøå])' ||
                   regexp_replace(lower(t.term), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                   '([^a-z0-9æøå]|$)'));
    r_rejected := r_rejected + coalesce(rej, 0);

    -- topics: canonical name, word-boundary match, >= 5 chars
    with candt as (
      select tp.id
      from topics tp
      where char_length(tp.name) >= 5
        and strpos(txt, lower(tp.name)) > 0
        and lower(tp.name) not in (select term from graph_stopterms)
        and txt ~ ('(^|[^a-z0-9æøå])' ||
                   regexp_replace(lower(tp.name), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                   '([^a-z0-9æøå]|$)')
    )
    insert into article_topics(article_id, topic_id, relevance_score)
    select a.id, c.id, 0.55 from candt c
    on conflict (article_id, topic_id) do nothing;
    get diagnostics tops = row_count;

    if ents > 0 then r_with_ent := r_with_ent + 1; end if;
    if tops > 0 then r_with_top := r_with_top + 1; end if;
    r_rel := r_rel + ents + tops;

    -- classification
    if ents >= 3 and tops >= 2 then
      cls := 'deterministic_complete'; r_a := r_a + 1;
    elsif ents + tops > 0 then
      cls := 'hybrid_pending'; r_b := r_b + 1;
    elsif char_length(a.content) < 600 then
      cls := 'complete_no_relations'; r_d := r_d + 1;
    else
      cls := 'ai_required'; r_c := r_c + 1;
    end if;

    update articles set
      enrich_class = cls,
      deterministic_pass_at = now(),
      enrichment_status = case
        when cls = 'deterministic_complete' then 'deterministic_complete'
        when cls = 'complete_no_relations' then 'complete_no_relations'
        else enrichment_status end,
      enrich_priority = coalesce(enrich_priority, 0)
        + case when cls = 'hybrid_pending' then 5 when cls = 'ai_required' then 2 else 0 end
    where id = a.id;
  end loop;

  return jsonb_build_object(
    'inspected', r_inspected, 'with_entity_matches', r_with_ent,
    'with_topic_matches', r_with_top, 'relations_added', r_rel,
    'nodes_created', 0, 'rejected_matches', r_rejected,
    'deterministic_complete', r_a, 'hybrid_pending', r_b,
    'ai_required', r_c, 'complete_no_relations', r_d);
end;
$$;

revoke all on function public.deterministic_enrich_batch(int) from public, anon, authenticated;

-- 4. Graph hygiene classification (detection only, never merges) -------------
alter table public.node_merge_candidates
  add column if not exists hygiene_class text;

create or replace function public.classify_merge_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare res jsonb;
begin
  update node_merge_candidates c set hygiene_class = sub.cls
  from (
    select c2.id,
      case
        when normalize_node_name(c2.primary_name) = normalize_node_name(c2.duplicate_name)
          then 'exact_normalized_duplicate'
        when c2.node_type = 'entity' and exists (
              select 1 from entities e
              where e.id = c2.primary_id
                and lower(c2.duplicate_name) = any (select lower(x) from unnest(coalesce(e.aliases,'{}')) x))
          then 'alias_language_variant'
        when similarity(lower(c2.primary_name), lower(c2.duplicate_name)) >= 0.85 then 'probable_duplicate'
        when similarity(lower(c2.primary_name), lower(c2.duplicate_name)) >= 0.70 then 'ambiguous'
        else 'distinct'
      end as cls
    from node_merge_candidates c2
  ) sub
  where sub.id = c.id;

  select jsonb_object_agg(hygiene_class, n) into res
  from (select hygiene_class, count(*) n from node_merge_candidates group by 1) t;
  return coalesce(res, '{}'::jsonb);
end;
$$;

revoke all on function public.classify_merge_candidates() from public, anon, authenticated;

-- 5. Requeue articles that were failed purely by gateway 402 -----------------
update public.articles
set enrichment_status = 'pending',
    enrich_retry_count = 0,
    enrich_failure_reason = null
where enrichment_status = 'failed'
  and enrich_failure_reason ilike '%402%';

-- 6. Graph readiness metric ---------------------------------------------------
create or replace function public.graph_ready_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'published', count(*) filter (where published),
    'ai_enriched', count(*) filter (where enrichment_status in ('complete_with_relations','complete_no_relations')),
    'graph_ready', count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations','deterministic_complete')),
    'pending', count(*) filter (where enrichment_status in ('pending','retry')),
    'failed', count(*) filter (where enrichment_status = 'failed'),
    'ai_coverage_pct', round(100.0 * count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations'))
        / nullif(count(*) filter (where published),0), 2),
    'graph_ready_pct', round(100.0 * count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations','deterministic_complete'))
        / nullif(count(*) filter (where published),0), 2))
  from public.articles;
$$;
