-- Runs only in the disposable PIPELINE-02 PostgreSQL fixture, after the Edge test.
\set ON_ERROR_STOP on
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    ASSERT NOT has_table_privilege(role_name, 'public.editorial_candidates', 'SELECT');
    ASSERT NOT has_table_privilege(role_name, 'public.editorial_candidate_observations', 'SELECT');
    ASSERT NOT has_function_privilege(role_name, 'public.record_editorial_candidate_batch(uuid,jsonb)', 'EXECUTE');
    ASSERT NOT has_function_privilege(role_name, 'public.reserve_editorial_generation(uuid,uuid,jsonb)', 'EXECUTE');
  END LOOP;
  ASSERT has_function_privilege('service_role', 'public.record_editorial_candidate_batch(uuid,jsonb)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.reserve_editorial_generation(uuid,uuid,jsonb)', 'EXECUTE');
  ASSERT NOT has_function_privilege('service_role', 'public.claim_editorial_candidates(text[])', 'EXECUTE');
  ASSERT NOT has_table_privilege('service_role', 'public.editorial_generation_pilot', 'INSERT');
  ASSERT NOT has_table_privilege('service_role', 'public.editorial_generation_reservations', 'DELETE');
  ASSERT (SELECT count(*) FROM pg_class
     WHERE oid IN ('public.editorial_candidates'::regclass, 'public.editorial_candidate_observations'::regclass,
       'public.editorial_generation_pilot'::regclass, 'public.editorial_generation_reservations'::regclass)
       AND relrowsecurity) = 4;
  ASSERT (SELECT count(*) FROM public.articles) = 50005, 'Edge activity created articles';
  ASSERT (SELECT count(*) FROM public.editorial_candidate_observations) = 10;
  ASSERT (SELECT count(*) FROM public.editorial_candidates) = 4;
  ASSERT (SELECT count(*) FROM public.editorial_candidates WHERE reason_code = 'existing_article') = 2;
  ASSERT (SELECT count(DISTINCT feed_id) FROM public.editorial_candidate_observations o JOIN public.editorial_candidates c
          ON c.id=o.candidate_id WHERE c.source_key='source.invalid/repeat') = 2;
  ASSERT (SELECT count(*) FROM public.pipeline_runs WHERE job_name='fetch-and-process-feeds'
          AND status='success' AND details->>'fetch_only'='true' AND processed=6) = 1;
END;
$$;
SELECT job_name, status, processed,
       details - ARRAY['feeds','registry_batch_hash','run_id'] AS metrics
  FROM public.pipeline_runs ORDER BY started_at;

INSERT INTO public.pipeline_runs(id, job_name)
VALUES ('10000000-0000-0000-0000-000000000001', 'editorial-candidate-registry');
SET ROLE service_role;
DO $$
DECLARE
  run constant uuid := '10000000-0000-0000-0000-000000000001';
  active_feed constant uuid := '00000000-0000-0000-0000-000000000001';
  good jsonb := jsonb_build_array(jsonb_build_object(
    'feed_id', active_feed, 'source_url','https://source.invalid/replay','title','Fixture',
    'pre_score',0.9,'evidence_chars',900,'published_at',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
  result jsonb;
  denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.record_editorial_candidate_batch(run, good);
    RAISE EXCEPTION using errcode='22012', message='simulated abort after write';
  EXCEPTION WHEN division_by_zero THEN denied := true;
  END;
  ASSERT denied;
  ASSERT NOT EXISTS(SELECT 1 FROM public.editorial_candidates WHERE source_key='source.invalid/replay');
  ASSERT NOT (SELECT details ? 'registry_batch_hash' FROM public.pipeline_runs WHERE id=run);
  result := public.record_editorial_candidate_batch(run, good);
  ASSERT public.record_editorial_candidate_batch(run, good) = result;
  ASSERT (SELECT count(*) FROM public.editorial_candidate_observations WHERE run_id=run) = 1;
  BEGIN
    PERFORM public.record_editorial_candidate_batch(run, '[]');
    RAISE EXCEPTION 'expected failure did not occur';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'registry_batch_payload_changed';
  END;
  PERFORM public.complete_pipeline_run(run, 'success', _details => result);
END;
$$;
RESET ROLE;

INSERT INTO public.pipeline_runs(id, job_name)
VALUES ('10000000-0000-0000-0000-000000000002', 'editorial-candidate-registry');
SET ROLE service_role;
DO $$
DECLARE
  run constant uuid := '10000000-0000-0000-0000-000000000002';
  invalid text;
BEGIN
  FOREACH invalid IN ARRAY ARRAY['00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'] LOOP
    BEGIN
      PERFORM public.record_editorial_candidate_batch(run, jsonb_build_array(
        jsonb_build_object('feed_id', invalid,'source_url','https://source.invalid/invalid')));
      RAISE EXCEPTION 'expected failure did not occur';
    EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'invalid_feed_provenance';
    END;
  END LOOP;
  PERFORM public.complete_pipeline_run(run,'failed');
END;
$$;
RESET ROLE;

DO $$
DECLARE run constant uuid := '10000000-0000-0000-0000-000000000001';
BEGIN
  BEGIN
    DELETE FROM public.pipeline_runs WHERE id=run;
    RAISE EXCEPTION 'journal restriction missing';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  UPDATE public.editorial_candidate_observations SET observed_at=now()-interval '31 days' WHERE run_id=run;
  UPDATE public.editorial_candidates SET first_seen=now()-interval '31 days',last_seen=now()-interval '31 days',
    claimed_at=now()-interval '45 days' WHERE source_key='source.invalid/replay';
  ASSERT public.prune_editorial_candidate_registry() =
    '{"candidates_removed":0,"observations_removed":1}'::jsonb;
  ASSERT EXISTS(SELECT 1 FROM public.editorial_candidates WHERE source_key='source.invalid/replay');
  DELETE FROM public.pipeline_runs WHERE id=run;
  UPDATE public.editorial_candidates SET claimed_at=now()-interval '91 days' WHERE source_key='source.invalid/replay';
  ASSERT public.prune_editorial_candidate_registry() =
    '{"candidates_removed":1,"observations_removed":0}'::jsonb;
  ASSERT NOT EXISTS(SELECT 1 FROM public.editorial_candidates WHERE source_key='source.invalid/replay');
END;
$$;

INSERT INTO public.pipeline_runs(id, job_name)
VALUES ('10000000-0000-0000-0000-000000000003', 'editorial-candidate-registry');
SELECT public.record_editorial_candidate_batch('10000000-0000-0000-0000-000000000003', (
  SELECT jsonb_agg(jsonb_build_object(
    'feed_id', '00000000-0000-0000-0000-000000000001','source_url','https://source.invalid/'||slug,
    'title','Fixture','pre_score',0.9,'evidence_chars',900,
    'published_at',to_char((now()-age) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
    FROM (VALUES ('pilot1',interval '1 hour'),('pilot2',interval '2 hours'),('stale', interval '90 hours')) AS v(slug,age)
));
SELECT public.complete_pipeline_run('10000000-0000-0000-0000-000000000003','success',
  _details => (SELECT details FROM public.pipeline_runs WHERE id='10000000-0000-0000-0000-000000000003'));
INSERT INTO public.editorial_generation_pilot (id, expires_at, candidate_ids)
SELECT '20000000-0000-0000-0000-000000000000', now() + interval '1 hour', array_agg(id)
  FROM public.editorial_candidates WHERE source_key IN ('source.invalid/pilot1','source.invalid/stale');
DO $$
DECLARE picked text := (SELECT id FROM public.editorial_candidates WHERE source_key='source.invalid/stale');
BEGIN
  ASSERT EXISTS(SELECT 1 FROM public.editorial_candidates WHERE id=picked AND reason_code='qualified'
    AND last_seen > now() - interval '24 hours');
  BEGIN
    PERFORM public.reserve_editorial_generation('20000000-0000-0000-0000-000000000000',
      '20000000-0000-0000-0000-000000000003',
      jsonb_build_array(jsonb_build_object('id',picked,'source_published_at',now()-interval '1 hour','evidence_verified_at',now())));
    RAISE EXCEPTION 'stale feed accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='pilot_candidate_not_claimable';
  END;
  ASSERT NOT EXISTS(SELECT 1 FROM public.editorial_generation_reservations);
END;
$$;
UPDATE public.editorial_generation_pilot SET candidate_ids =
  (SELECT array_agg(id) FROM public.editorial_candidates WHERE source_key IN ('source.invalid/pilot1','source.invalid/pilot2'));

DO $$
DECLARE
  picked text := (SELECT id FROM public.editorial_candidates WHERE source_key='source.invalid/pilot1');
  times record;
BEGIN
  FOR times IN SELECT * FROM (VALUES
    (now()-interval '90 hours', now()),
    (now()-interval '1 hour', now()-interval '16 minutes'),
    (NULL::timestamptz, now())
  ) AS t(source_time, verified_time) LOOP
    BEGIN
      PERFORM public.reserve_editorial_generation('20000000-0000-0000-0000-000000000000',
        '20000000-0000-0000-0000-000000000004',
        jsonb_build_array(jsonb_build_object('id',picked,
          'source_published_at',times.source_time,'evidence_verified_at',times.verified_time)));
      RAISE EXCEPTION 'invalid evidence accepted';
    EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='pilot_candidate_not_claimable';
    END;
  END LOOP;
  ASSERT NOT EXISTS(SELECT 1 FROM public.editorial_generation_reservations);
END;
$$;
