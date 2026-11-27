#!/usr/bin/env bash
# Requires registry-check.sql to have prepared the disposable fixture.
set -euo pipefail
db() { docker exec -i -e PGAPPNAME="${PGAPPNAME:-pipeline-pilot}" marketrends-pipeline02-pg psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
pilot_id=20000000-0000-0000-0000-000000000000
ids=$(db -Atc "SELECT id FROM public.editorial_candidates WHERE source_key IN ('source.invalid/pilot1','source.invalid/pilot2') ORDER BY source_key;")
readarray -t picked <<< "$ids"

reserve() {
  local id=$1 request=$2 hold=$3
  db -Atq -v pilot="$pilot_id" -v id="$id" -v request="$request" -v hold="$hold" <<'SQL'
BEGIN;
SET LOCAL ROLE service_role;
SELECT slot FROM public.reserve_editorial_generation(:'pilot', :'request',
    jsonb_build_array(jsonb_build_object(
      'id', :'id', 'source_published_at', now()-interval '1 hour','evidence_verified_at',now())));
SELECT pg_sleep(:'hold');
COMMIT;
SQL
}
wait_advisory() {
  local app=$1 granted=$2
  for _ in {1..40}; do
    if [[ $(db -Atc "SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING(pid)
      WHERE locktype='advisory' AND classid=74321 AND objid=1
      AND a.application_name='$app' AND l.granted='$granted';") == 1 ]]; then
      printf 'Observed pilot advisory lock: %s granted=%s\n' "$app" "$granted"
      return
    fi
    sleep 0.15
  done
  return 1
}
expect_denied() {
  local pattern=$1 output
  shift
  if output=$("$@" 2>&1); then
    printf 'Unexpected reservation success\n' >&2
    return 1
  fi
  printf '%s\n' "$output"
  [[ "$output" == *"$pattern"* ]]
}

db -q <<'SQL'
BEGIN;
UPDATE public.editorial_generation_pilot SET revoked_at=now();
DO $$
DECLARE picked text := (SELECT id FROM public.editorial_candidates WHERE source_key='source.invalid/pilot1');
BEGIN
  BEGIN
    PERFORM public.reserve_editorial_generation('20000000-0000-0000-0000-000000000000',
      '20000000-0000-0000-0000-000000000040',
      jsonb_build_array(jsonb_build_object('id',picked,'source_published_at',now(),'evidence_verified_at',now())));
    RAISE EXCEPTION 'revoked pilot accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='pilot_not_authorized';
  END;
END;
$$;
ROLLBACK;
SQL

req1=20000000-0000-0000-0000-000000000011
req2=20000000-0000-0000-0000-000000000012
PGAPPNAME=pilot-first reserve "${picked[0]}" "$req1" 4 &
first=$!
wait_advisory pilot-first t
PGAPPNAME=pilot-second reserve "${picked[1]}" "$req2" 0 &
second=$!
wait_advisory pilot-second f
wait "$first"
wait "$second"

expect_denied pilot_request_replayed reserve "${picked[0]}" "$req1" 0
expect_denied pilot_request_replayed reserve "${picked[1]}" "$req1" 0
expect_denied pilot_budget_exhausted reserve "${picked[0]}" 20000000-0000-0000-0000-000000000013 0
[[ $(db -Atc "SELECT array_agg(slot ORDER BY slot) = ARRAY[1, 2]::smallint[]
  AND count(DISTINCT request_id) = 2 AND count(DISTINCT candidate_id) = 2
  FROM public.editorial_generation_reservations") == t ]]
[[ $(db -Atc "SELECT count(*) FROM public.articles") == 50005 ]]
printf 'Exactly two persistent slots across separate requests. No article writes.\n'
