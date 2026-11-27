-- One separately authorized pilot. Applying this migration authorizes zero calls.
CREATE TABLE public.editorial_generation_pilot (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  id uuid NOT NULL UNIQUE,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  candidate_ids text[] NOT NULL CHECK (cardinality(candidate_ids) BETWEEN 1 AND 2),
  CHECK (expires_at > authorized_at AND expires_at <= authorized_at + interval '24 hours')
);

CREATE TABLE public.editorial_generation_reservations (
  pilot_id uuid NOT NULL REFERENCES public.editorial_generation_pilot(id) ON DELETE RESTRICT,
  slot smallint NOT NULL CHECK (slot IN (1, 2)),
  request_id uuid NOT NULL,
  candidate_id text NOT NULL CHECK (candidate_id ~ '^[0-9a-f]{64}$'),
  reserved_at timestamptz NOT NULL,
  source_published_at timestamptz NOT NULL,
  evidence_verified_at timestamptz NOT NULL,
  PRIMARY KEY (pilot_id, slot),
  UNIQUE (pilot_id, candidate_id)
);

ALTER TABLE public.editorial_generation_pilot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorial_generation_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.editorial_generation_pilot, public.editorial_generation_reservations
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_editorial_candidates(text[]) FROM service_role;

-- Definer is required here to keep the service role from authorizing or refilling
-- the pilot by direct writes. The owner alone grants authorization by inserting
-- the singleton row, and can revoke it by stamping revoked_at.
CREATE FUNCTION public.reserve_editorial_generation(_pilot_id uuid, _request_id uuid, _selection jsonb)
RETURNS TABLE (id text, source_key text, slot smallint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pilot public.editorial_generation_pilot%ROWTYPE;
  reserved integer;
  picked integer;
  candidate_ids text[];
  checked_at timestamptz;
BEGIN
  IF _pilot_id IS NULL OR _request_id IS NULL OR jsonb_typeof(_selection) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_pilot_request';
  END IF;
  picked := jsonb_array_length(_selection);
  IF picked NOT BETWEEN 1 AND 2 OR octet_length(_selection::text) > 2048 THEN
    RAISE EXCEPTION 'invalid_pilot_request';
  END IF;
  SELECT array_agg(value->>'id' ORDER BY ord)
    INTO candidate_ids FROM jsonb_array_elements(_selection) WITH ORDINALITY AS s(value, ord);
  IF EXISTS (SELECT 1 FROM unnest(candidate_ids) AS wanted(id)
              WHERE wanted.id IS NULL OR wanted.id !~ '^[0-9a-f]{64}$') OR
     (SELECT count(DISTINCT wanted.id) FROM unnest(candidate_ids) AS wanted(id)) <> picked THEN
    RAISE EXCEPTION 'invalid_pilot_request';
  END IF;

  PERFORM pg_advisory_xact_lock(74321, 1);
  SELECT * INTO pilot FROM public.editorial_generation_pilot p WHERE p.id = _pilot_id FOR UPDATE;
  checked_at := clock_timestamp();
  IF NOT FOUND OR pilot.revoked_at IS NOT NULL OR pilot.authorized_at > checked_at OR pilot.expires_at <= checked_at THEN
    RAISE EXCEPTION 'pilot_not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM public.editorial_generation_reservations r WHERE r.request_id = _request_id) THEN
    RAISE EXCEPTION 'pilot_request_replayed';
  END IF;
  IF NOT (pilot.candidate_ids @> candidate_ids) THEN
    RAISE EXCEPTION 'candidate_not_authorized';
  END IF;
  SELECT count(*) INTO reserved FROM public.editorial_generation_reservations r WHERE r.pilot_id = _pilot_id;
  IF reserved + picked > 2 THEN
    RAISE EXCEPTION 'pilot_budget_exhausted';
  END IF;

  IF (SELECT count(*) FROM jsonb_to_recordset(_selection)
        AS s(id text, source_published_at timestamptz, evidence_verified_at timestamptz)
       JOIN public.editorial_candidates c ON c.id = s.id
       WHERE c.claimed_at IS NULL AND c.reason_code = 'qualified'
         AND c.last_seen BETWEEN checked_at - interval '24 hours' AND checked_at
         AND s.source_published_at BETWEEN checked_at - interval '72 hours' AND checked_at
         AND s.evidence_verified_at BETWEEN checked_at - interval '15 minutes' AND checked_at
         AND EXISTS (SELECT 1 FROM public.editorial_candidate_observations o
            WHERE o.candidate_id = c.id AND o.observed_at = c.last_seen
              AND o.reason_code = 'qualified'
              AND o.published_at BETWEEN checked_at - interval '72 hours' AND checked_at)
         AND NOT EXISTS (SELECT 1 FROM public.articles a
           WHERE public.editorial_source_key(a.source_url) COLLATE "C" = c.source_key))
       <> picked THEN
    RAISE EXCEPTION 'pilot_candidate_not_claimable';
  END IF;

  INSERT INTO public.editorial_generation_reservations
    (pilot_id, slot, request_id, candidate_id, reserved_at, source_published_at, evidence_verified_at)
  SELECT _pilot_id, (reserved + ord)::smallint, _request_id, value->>'id', checked_at,
         (value->>'source_published_at')::timestamptz, (value->>'evidence_verified_at')::timestamptz
  FROM jsonb_array_elements(_selection) WITH ORDINALITY AS s(value, ord);
  UPDATE public.editorial_candidates c SET claimed_at = checked_at WHERE c.id = ANY (candidate_ids);
  RETURN QUERY SELECT c.id, c.source_key, r.slot
    FROM public.editorial_generation_reservations r
    JOIN public.editorial_candidates c ON c.id = r.candidate_id
    WHERE r.request_id = _request_id ORDER BY r.slot;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_editorial_generation(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_editorial_generation(uuid, uuid, jsonb) TO service_role;
