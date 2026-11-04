-- Phase 6.2F: allow deterministic terminal states and keep AI coverage honest.

alter table public.articles drop constraint if exists articles_enrichment_status_chk;
alter table public.articles add constraint articles_enrichment_status_chk
  check (enrichment_status = any (array[
    'pending','retry','complete_with_relations','complete_no_relations','failed',
    'deterministic_complete','deterministic_no_relations']));

-- Deterministic pre-pass v2: terminal states separated from AI states,
-- idempotent priority bump, no node creation.
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
  r_ent int := 0; r_top int := 0; r_rejected int := 0;
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

    with cand as (
      select e.id
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
    r_ent := r_ent + ents; r_top := r_top + tops;

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
        when cls = 'complete_no_relations' then 'deterministic_no_relations'
        else enrichment_status end,
      enrich_priority = coalesce(enrich_priority, 0)
        + case when deterministic_pass_at is not null then 0
               when cls = 'hybrid_pending' then 5
               when cls = 'ai_required' then 2 else 0 end
    where id = a.id;
  end loop;

  return jsonb_build_object(
    'inspected', r_inspected, 'with_entity_matches', r_with_ent,
    'with_topic_matches', r_with_top,
    'entity_relations_added', r_ent, 'topic_relations_added', r_top,
    'nodes_created', 0, 'rejected_matches', r_rejected,
    'deterministic_complete', r_a, 'hybrid_pending', r_b,
    'ai_required', r_c, 'complete_no_relations', r_d);
end;
$$;

revoke all on function public.deterministic_enrich_batch(int) from public, anon, authenticated;

-- Graph readiness: AI coverage stays AI-only; graph-ready adds deterministic terminals.
create or replace function public.graph_ready_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'published', count(*) filter (where published),
    'ai_enriched', count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations')),
    'graph_ready', count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations',
         'deterministic_complete','deterministic_no_relations')),
    'pending', count(*) filter (where enrichment_status in ('pending','retry')),
    'failed', count(*) filter (where enrichment_status = 'failed'),
    'ai_coverage_pct', round(100.0 * count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations'))
        / nullif(count(*) filter (where published),0), 2),
    'graph_ready_pct', round(100.0 * count(*) filter (where enrichment_status in
        ('complete_with_relations','complete_no_relations',
         'deterministic_complete','deterministic_no_relations'))
        / nullif(count(*) filter (where published),0), 2))
  from public.articles;
$$;