-- Phase 6.2D — deterministic-first graph convergence (review-only hygiene).
alter table public.topics add column if not exists aliases text[] default '{}'::text[];

update public.entities e
set aliases = (
  select array_agg(distinct x) from unnest(
    coalesce(e.aliases,'{}'::text[])
    || array[btrim(regexp_replace(e.name, '\s*\(.*\)\s*$', ''))]
    || array[btrim((regexp_match(e.name, '\(([^()]+)\)\s*$'))[1])]
  ) x where x is not null and char_length(x) >= 3
)
where e.name ~ '\([^()]+\)\s*$';

update public.topics t
set aliases = (
  select array_agg(distinct x) from unnest(
    coalesce(t.aliases,'{}'::text[])
    || array[btrim(regexp_replace(t.name, '\s*\(.*\)\s*$', ''))]
    || array[btrim((regexp_match(t.name, '\(([^()]+)\)\s*$'))[1])]
  ) x where x is not null and char_length(x) >= 3
)
where t.name ~ '\([^()]+\)\s*$';

create or replace function public.deterministic_alias_pass(_limit int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  txt text;
  ents int; tops int;
  ec int; tc int;
  r_inspected int := 0; r_rel_e int := 0; r_rel_t int := 0; r_promoted int := 0;
begin
  for a in
    select id, title, coalesce(content,'') as content
    from articles
    where published and enrich_class = 'hybrid_pending'
    order by enrich_priority desc nulls last, created_at desc
    limit _limit
  loop
    r_inspected := r_inspected + 1;
    txt := lower(a.title || ' ' || left(a.content, 20000));

    with cand as (
      select e.id
      from entities e
      cross join lateral unnest(array[e.name] || coalesce(e.aliases,'{}'::text[])) as t(term)
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

    with candt as (
      select tp.id
      from topics tp
      cross join lateral unnest(array[tp.name] || coalesce(tp.aliases,'{}'::text[])) as t(term)
      where char_length(t.term) >= 5
        and strpos(txt, lower(t.term)) > 0
        and lower(t.term) not in (select term from graph_stopterms)
        and txt ~ ('(^|[^a-z0-9æøå])' ||
                   regexp_replace(lower(t.term), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') ||
                   '([^a-z0-9æøå]|$)')
      group by tp.id
    )
    insert into article_topics(article_id, topic_id, relevance_score)
    select a.id, c.id, 0.55 from candt c
    on conflict (article_id, topic_id) do nothing;
    get diagnostics tops = row_count;

    r_rel_e := r_rel_e + ents;
    r_rel_t := r_rel_t + tops;

    select count(*) into ec from article_entities where article_id = a.id;
    select count(*) into tc from article_topics where article_id = a.id;

    if ec >= 3 and tc >= 2 then
      update articles
      set enrich_class = 'deterministic_complete',
          enrichment_status = 'deterministic_complete',
          deterministic_pass_at = now()
      where id = a.id;
      r_promoted := r_promoted + 1;
    else
      update articles set deterministic_pass_at = now() where id = a.id;
    end if;
  end loop;

  return jsonb_build_object(
    'inspected', r_inspected, 'entity_relations_added', r_rel_e,
    'topic_relations_added', r_rel_t, 'promoted_to_terminal', r_promoted,
    'nodes_created', 0);
end;
$$;

revoke all on function public.deterministic_alias_pass(int) from public, anon, authenticated;

alter table public.articles
  add column if not exists hybrid_bucket text,
  add column if not exists ai_priority_class text,
  add column if not exists ai_priority_score numeric,
  add column if not exists ai_priority_reasons jsonb default '{}'::jsonb,
  add column if not exists ai_required_reason text;

create or replace function public.score_ai_queue()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare res jsonb;
begin
  with base as (
    select a.id, a.created_at, a.category, a.enrich_class,
           coalesce(a.editorial_authority_score,0) auth,
           char_length(coalesce(a.content,'')) len,
           (a.embedding is not null) emb,
           (select count(*) from article_entities ae where ae.article_id=a.id) ec,
           (select count(*) from article_topics t where t.article_id=a.id) tc,
           (select coalesce(max(e.authority_score),0) from article_entities ae
              join entities e on e.id=ae.entity_id where ae.article_id=a.id) node_val
    from articles a
    where a.published and a.enrich_class in ('hybrid_pending','ai_required')
  ), scored as (
    select b.*,
      greatest(0, 30 - extract(epoch from (now()-b.created_at))/86400.0/12.0)
      + case when lower(coalesce(b.category,'')) ~
          '(ai|kunstig|krypto|crypto|fintech|invester|daytrading|trading|startup)' then 20 else 0 end
      + least(15, b.len/400.0)
      + case when b.ec between 1 and 2 then 12 when b.tc = 1 then 8 else 4 end
      + least(12, b.auth/8.0)
      + least(8, b.node_val/12.0)
      as score
    from base b
  ), classed as (
    select s.*,
      case when s.score >= 62 then 'P1'
           when s.score >= 48 then 'P2'
           when s.score >= 34 then 'P3'
           else 'P4' end as cls,
      case when s.ec >= 3 and s.tc >= 1 then 'H1'
           when s.ec >= 2 or s.tc >= 2 then 'H2'
           when (s.ec + s.tc) >= 1 and s.len >= 1500 then 'H3'
           else 'H4' end as bucket
    from scored s
  )
  update articles a
  set ai_priority_score = round(c.score,2),
      ai_priority_class = c.cls,
      hybrid_bucket = case when a.enrich_class='hybrid_pending' then c.bucket else null end,
      ai_priority_reasons = jsonb_build_object(
        'entity_matches', c.ec, 'topic_matches', c.tc,
        'content_length', c.len, 'authority', c.auth,
        'max_node_authority', c.node_val, 'has_embedding', c.emb,
        'category', c.category, 'age_days', round(extract(epoch from (now()-c.created_at))/86400.0))
  from classed c
  where c.id = a.id;

  select jsonb_object_agg(k, n) into res from (
    select ai_priority_class k, count(*) n from articles
    where published and ai_priority_class is not null group by 1) t;
  return coalesce(res,'{}'::jsonb);
end;
$$;

revoke all on function public.score_ai_queue() from public, anon, authenticated;

create or replace function public.classify_ai_required()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare res jsonb;
begin
  update articles a
  set ai_required_reason = case
    when char_length(coalesce(a.content,'')) < 900 then 'thin_content_no_safe_literal_evidence'
    when (select count(*) from article_entities ae where ae.article_id=a.id) = 0
     and (select count(*) from article_topics t where t.article_id=a.id) = 0
      then 'no_canonical_vocabulary_match'
    when (select count(*) from article_entities ae where ae.article_id=a.id) = 0
      then 'insufficient_canonical_entity_evidence'
    else 'insufficient_topic_evidence'
  end
  where a.published and a.enrich_class = 'ai_required';

  select jsonb_object_agg(ai_required_reason, n) into res from (
    select ai_required_reason, count(*) n from articles
    where published and enrich_class='ai_required' group by 1) t;
  return coalesce(res,'{}'::jsonb);
end;
$$;

revoke all on function public.classify_ai_required() from public, anon, authenticated;

create or replace function public.review_merge_candidates()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare res jsonb;
begin
  update node_merge_candidates c
  set status = case
    when c.hygiene_class = 'exact_normalized_duplicate' then 'safe_merge'
    when regexp_replace(c.primary_name, '\s*\([^()]*\)\s*$','') =
         regexp_replace(c.duplicate_name, '\s*\([^()]*\)\s*$','')
      then 'alias_only'
    when c.hygiene_class = 'alias_language_variant' then 'alias_only'
    when c.hygiene_class in ('probable_duplicate','ambiguous') then 'review_required'
    else 'keep_distinct'
  end
  where c.status in ('review','pending') or c.status is null;

  select jsonb_object_agg(status, n) into res
  from (select status, count(*) n from node_merge_candidates group by 1) t;
  return coalesce(res,'{}'::jsonb);
end;
$$;

revoke all on function public.review_merge_candidates() from public, anon, authenticated;

create or replace function public.graph_ready_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'published', count(*) filter (where published),
    'eligible', count(*) filter (where published),
    'ai_enriched', count(*) filter (where published and enrichment_status in
        ('complete_with_relations','complete_no_relations')),
    'deterministic_complete', count(*) filter (where published and enrichment_status='deterministic_complete'),
    'complete_no_relations', count(*) filter (where published and enrichment_status='complete_no_relations'),
    'deterministic_no_relations', count(*) filter (where published and enrichment_status='deterministic_no_relations'),
    'graph_ready', count(*) filter (where published and enrichment_status in
        ('complete_with_relations','complete_no_relations','deterministic_complete')),
    'hybrid_pending', count(*) filter (where published and enrich_class='hybrid_pending'),
    'ai_required', count(*) filter (where published and enrich_class='ai_required'),
    'pending', count(*) filter (where published and enrichment_status='pending'),
    'retry', count(*) filter (where published and enrichment_status='retry'),
    'failed', count(*) filter (where published and enrichment_status='failed'),
    'unclassified', count(*) filter (where published and enrich_class is null
        and enrichment_status in ('pending','retry')),
    'ai_coverage_pct', round(100.0 * count(*) filter (where published and enrichment_status in
        ('complete_with_relations','complete_no_relations'))
        / nullif(count(*) filter (where published),0), 2),
    'graph_ready_pct', round(100.0 * count(*) filter (where published and enrichment_status in
        ('complete_with_relations','complete_no_relations','deterministic_complete'))
        / nullif(count(*) filter (where published),0), 2))
  from articles;
$$;