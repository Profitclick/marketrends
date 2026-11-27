-- PIPELINE-01. Private registry, with no changes to the RSS scheduler or article writes.
CREATE FUNCTION public.editorial_source_key(_url text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = ''
AS $$
DECLARE
  parts text[];
  query text;
  pathname text;
BEGIN
  IF octet_length(_url) > 2048 OR _url ~ '[[:space:][:cntrl:]]'
     OR strpos(_url, chr(92)) > 0
     OR strpos(regexp_replace(_url, '%[0-9a-fA-F]{2}', '', 'g'), '%') > 0 THEN
    RETURN NULL;
  END IF;

  parts := regexp_match(regexp_replace(_url, '&(amp|#38|#x26);', '&', 'gi') COLLATE "C",
    '^(https?)://([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)(?::([0-9]+))?(/[^?#]*)?(\?[^#]*)?(?:#.*)?$', 'i');
  IF parts IS NULL OR length(parts[2]) > 253
     OR (parts[3] IS NOT NULL AND parts[3] <>
         CASE lower(parts[1]) WHEN 'http' THEN '80' ELSE '443' END) THEN
    RETURN NULL;
  END IF;

  SELECT string_agg(param, '&' ORDER BY ord) INTO query
    FROM unnest(string_to_array(substring(parts[5] FROM 2), '&')) WITH ORDINALITY AS q(param, ord)
   WHERE param <> ''
     AND split_part(param, '=', 1) !~* '^(utm_[a-z0-9_]+|fbclid|gclid|msclkid)$';
  pathname := regexp_replace(coalesce(parts[4], ''), '/$', '');
  IF pathname ~* '(^|/)(\.|\.\.|%2e|%2e%2e|\.%2e|%2e\.)(/|$)' OR
     (pathname = '' AND query IS NULL) THEN
    RETURN NULL;
  END IF;

  RETURN regexp_replace(lower(parts[2] COLLATE "C"), '^www\.', '') || pathname ||
    coalesce('?' || query, '');
END;
$$;

-- Non-unique so legacy duplicate articles do not prevent rollout.
CREATE INDEX articles_editorial_source_key_idx
  ON public.articles (public.editorial_source_key(source_url) COLLATE "C");

CREATE DOMAIN public.editorial_candidate_reason AS text
  CHECK (VALUE IN ('qualified', 'existing_article', 'missing_title',
    'invalid_pre_score', 'invalid_publication_time', 'insufficient_evidence', 'below_pre_score'));

CREATE TABLE public.editorial_candidates (
  id text COLLATE "C" PRIMARY KEY,
  source_key text COLLATE "C" NOT NULL UNIQUE,
  first_seen timestamptz NOT NULL,
  last_seen timestamptz NOT NULL CHECK (last_seen >= first_seen),
  reason_code public.editorial_candidate_reason NOT NULL,
  claimed_at timestamptz,
  CHECK (id = encode(sha256(convert_to(source_key, 'UTF8')), 'hex'))
);

CREATE TABLE public.editorial_candidate_observations (
  run_id uuid NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE RESTRICT,
  candidate_id text COLLATE "C" NOT NULL REFERENCES public.editorial_candidates(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL,
  feed_name text NOT NULL,
  observed_at timestamptz NOT NULL,
  title text,
  published_at timestamptz,
  pre_score numeric CHECK (pre_score BETWEEN 0 AND 1),
  evidence_chars integer CHECK (evidence_chars BETWEEN 0 AND 6000),
  reason_code public.editorial_candidate_reason NOT NULL,
  occurrences integer NOT NULL CHECK (occurrences BETWEEN 1 AND 35),
  PRIMARY KEY (run_id, candidate_id, feed_id)
);

CREATE INDEX editorial_candidates_last_seen_idx ON public.editorial_candidates (last_seen, id);
CREATE INDEX editorial_candidate_observations_seen_idx
  ON public.editorial_candidate_observations (observed_at, run_id, candidate_id, feed_id);
CREATE INDEX editorial_candidate_observations_candidate_idx
  ON public.editorial_candidate_observations (candidate_id, observed_at DESC);

ALTER TABLE public.editorial_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_candidate_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.editorial_candidates, public.editorial_candidate_observations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_candidates, public.editorial_candidate_observations
  TO service_role;

-- Serialize bounded registry writes, claims and retention. All changes for a batch
-- commit together with its replay marker in the existing pipeline journal.
CREATE FUNCTION public.record_editorial_candidate_batch(_run_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  journal public.pipeline_runs%ROWTYPE;
  observation record;
  payload_hash text;
  current_key text;
  candidate_id text;
  added integer := 0;
  known integer := 0;
  qualified integer := 0;
  rejected integer := 0;
  invalid_url integer := 0;
  report jsonb;
BEGIN
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_batch';
  END IF;
  IF jsonb_array_length(_items) > 35 OR octet_length(_items::text) > 150000 THEN
    RAISE EXCEPTION 'batch_limit_exceeded';
  END IF;

  PERFORM pg_advisory_xact_lock(74321, 1);
  SELECT * INTO journal FROM public.pipeline_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND OR journal.job_name <> 'editorial-candidate-registry' THEN
    RAISE EXCEPTION 'invalid_registry_run';
  END IF;
  payload_hash := encode(sha256(convert_to(_items::text, 'UTF8')), 'hex');
  IF journal.details ? 'registry_batch_hash' THEN
    IF journal.details->>'registry_batch_hash' <> payload_hash THEN
      RAISE EXCEPTION 'registry_batch_payload_changed';
    END IF;
    RETURN journal.details;
  END IF;
  IF journal.status <> 'running' THEN
    RAISE EXCEPTION 'registry_run_not_running';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_items) AS i(feed_id uuid)
    LEFT JOIN public.rss_feeds f ON f.id = i.feed_id AND f.active IS TRUE
    WHERE f.id IS NULL OR nullif(btrim(f.name), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_feed_provenance';
  END IF;

  FOR observation IN
    WITH parsed AS (
      SELECT i.feed_id, left(f.name, 300) AS feed_name,
             public.editorial_source_key(i.source_url) COLLATE "C" AS source_key,
             nullif(left(btrim(i.title), 300), '') AS title,
             CASE WHEN i.published_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,3})?Z$'
                  THEN i.published_at::timestamptz END AS published_at,
             CASE WHEN i.pre_score BETWEEN 0 AND 1 THEN i.pre_score END AS pre_score,
             CASE WHEN i.evidence_chars BETWEEN 0 AND 6000 THEN i.evidence_chars END AS evidence_chars
        FROM jsonb_to_recordset(_items)
          AS i(feed_id uuid, source_url text, title text, published_at text,
               pre_score numeric, evidence_chars integer)
        JOIN public.rss_feeds f ON f.id = i.feed_id
    ), scored AS (
      SELECT p.*, CASE
        WHEN p.source_key IS NULL THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.articles a
          WHERE public.editorial_source_key(a.source_url) COLLATE "C" = p.source_key
        ) THEN 'existing_article'
        WHEN p.title IS NULL THEN 'missing_title'
        WHEN p.pre_score IS NULL THEN 'invalid_pre_score'
        WHEN p.published_at IS NULL OR NOT isfinite(p.published_at)
          OR p.published_at > journal.started_at + interval '5 minutes' THEN 'invalid_publication_time'
        WHEN coalesce(p.evidence_chars, 0) < 800 THEN 'insufficient_evidence'
        WHEN p.pre_score < 0.55 THEN 'below_pre_score'
        ELSE 'qualified'
      END AS reason
      FROM parsed p
    )
    SELECT * FROM scored ORDER BY source_key,
      (reason = 'qualified') DESC, pre_score DESC NULLS LAST,
      evidence_chars DESC NULLS LAST, published_at DESC NULLS LAST,
      title COLLATE "C", feed_id
  LOOP
    IF observation.source_key IS NULL THEN
      invalid_url := invalid_url + 1;
      CONTINUE;
    END IF;

    candidate_id := encode(sha256(convert_to(observation.source_key, 'UTF8')), 'hex');
    IF current_key IS DISTINCT FROM observation.source_key THEN
      current_key := observation.source_key;
      INSERT INTO public.editorial_candidates (id, source_key, first_seen, last_seen, reason_code)
      VALUES (candidate_id, current_key, journal.started_at, journal.started_at, observation.reason)
      ON CONFLICT (source_key) DO NOTHING;
      IF FOUND THEN
        added := added + 1;
      ELSE
        known := known + 1;
        UPDATE public.editorial_candidates c
           SET first_seen = least(c.first_seen, journal.started_at),
               last_seen = greatest(c.last_seen, journal.started_at),
               reason_code = CASE WHEN c.last_seen <= journal.started_at
                                  THEN observation.reason::public.editorial_candidate_reason
                                  ELSE c.reason_code END
         WHERE c.id = candidate_id;
      END IF;
      IF observation.reason = 'qualified' THEN
        qualified := qualified + 1;
      ELSE
        rejected := rejected + 1;
      END IF;
    END IF;

    INSERT INTO public.editorial_candidate_observations AS o
      (run_id, candidate_id, feed_id, feed_name, observed_at, title, published_at,
       pre_score, evidence_chars, reason_code, occurrences)
    VALUES (_run_id, candidate_id, observation.feed_id, observation.feed_name,
      journal.started_at, observation.title, observation.published_at,
      observation.pre_score, observation.evidence_chars, observation.reason, 1)
    ON CONFLICT ON CONSTRAINT editorial_candidate_observations_pkey DO UPDATE
      SET occurrences = o.occurrences + 1;
  END LOOP;

  report := jsonb_build_object(
    'registry_batch_hash', payload_hash, 'run_id', _run_id,
    'rss_observations', jsonb_array_length(_items), 'unique_source_articles', added + known,
    'new_candidates', added, 'known_candidates', known,
    'qualified_candidates', qualified, 'rejected_candidates', rejected,
    'unidentified_observations', jsonb_build_object('invalid_source_url', invalid_url),
    'ai_calls', 0, 'drafts_created', 0, 'published_articles', 0
  );
  UPDATE public.pipeline_runs SET details = report WHERE id = _run_id;
  RETURN report;
END;
$$;

-- Prepared for a future manual generator. One all-or-nothing claim, across
-- concurrent invocations, before any call. Claims are never auto-released.
CREATE FUNCTION public.claim_editorial_candidates(_ids text[])
RETURNS TABLE (id text, source_key text)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(cardinality(_ids), 0) NOT BETWEEN 1 AND 2 OR
     EXISTS (SELECT 1 FROM unnest(_ids) AS wanted(value)
       WHERE value IS NULL OR value !~ '^[0-9a-f]{64}$') OR
     (SELECT count(DISTINCT value) FROM unnest(_ids) AS wanted(value)) <> cardinality(_ids) THEN
    RAISE EXCEPTION 'invalid_candidate_selection';
  END IF;
  PERFORM pg_advisory_xact_lock(74321, 1);
  IF (SELECT count(*) FROM public.editorial_candidates c
       WHERE c.id = ANY (_ids) AND c.claimed_at IS NULL AND c.reason_code = 'qualified'
         AND c.last_seen >= now() - interval '24 hours'
         AND NOT EXISTS (SELECT 1 FROM public.articles a
           WHERE public.editorial_source_key(a.source_url) COLLATE "C" = c.source_key))
      <> cardinality(_ids) THEN
    RAISE EXCEPTION 'candidate_not_claimable';
  END IF;

  UPDATE public.editorial_candidates c SET claimed_at = now() WHERE c.id = ANY (_ids);
  RETURN QUERY SELECT c.id, c.source_key FROM public.editorial_candidates c
    JOIN unnest(_ids) WITH ORDINALITY AS wanted(value, position) ON wanted.value = c.id
   ORDER BY wanted.position;
END;
$$;

-- Operator-run retention only. Limit oldest rows first, including separately
-- expiring observations for still-active candidates. No cron is installed.
CREATE FUNCTION public.prune_editorial_candidate_registry()
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  observations_removed integer;
  candidates_removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(74321, 1);
  DELETE FROM public.editorial_candidate_observations o USING (
    SELECT run_id, candidate_id, feed_id FROM public.editorial_candidate_observations
     WHERE observed_at < now() - interval '30 days'
     ORDER BY observed_at, run_id, candidate_id, feed_id LIMIT 500
  ) expired WHERE (o.run_id, o.candidate_id, o.feed_id) =
                  (expired.run_id, expired.candidate_id, expired.feed_id);
  GET DIAGNOSTICS observations_removed = ROW_COUNT;
  DELETE FROM public.editorial_candidates c USING (
    SELECT candidate.id FROM public.editorial_candidates candidate
     WHERE candidate.last_seen < now() - interval '30 days'
       AND (candidate.claimed_at IS NULL OR candidate.claimed_at < now() - interval '90 days')
       AND NOT EXISTS (SELECT 1 FROM public.editorial_candidate_observations o
                       WHERE o.candidate_id = candidate.id)
     ORDER BY candidate.last_seen, candidate.id LIMIT 500
  ) expired WHERE c.id = expired.id;
  GET DIAGNOSTICS candidates_removed = ROW_COUNT;
  RETURN jsonb_build_object('observations_removed', observations_removed, 'candidates_removed', candidates_removed);
END;
$$;

REVOKE ALL ON FUNCTION public.editorial_source_key(text),
  public.record_editorial_candidate_batch(uuid, jsonb),
  public.claim_editorial_candidates(text[]), public.prune_editorial_candidate_registry()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_editorial_candidate_batch(uuid, jsonb),
  public.claim_editorial_candidates(text[]), public.prune_editorial_candidate_registry()
  TO service_role;
-- Index maintenance calls the immutable URL helper for every legacy article writer.
GRANT EXECUTE ON FUNCTION public.editorial_source_key(text) TO authenticated, service_role;
