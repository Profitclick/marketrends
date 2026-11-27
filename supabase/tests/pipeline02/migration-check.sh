#!/usr/bin/env bash
# Requires the disposable container named below, initialized with bootstrap.sh.
set -euo pipefail
cd "$(dirname "$0")/../../.."
db() { docker exec -i -e PGAPPNAME="${PGAPPNAME:-pipeline-generality}" marketrends-pipeline02-pg psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }
registry=supabase/migrations/20261127042841_editorial_candidate_registry.sql
pilot=supabase/migrations/20261127044853_editorial_generation_pilot.sql
expect_failure() {
  local pattern=$1 output
  shift
  if output=$("$@" 2>&1); then
    printf 'Unexpected success\n' >&2
    return 1
  fi
  printf '%s\n' "$output"
  [[ "$output" == *"$pattern"* ]]
}
wait_lock() {
  local application=$1 mode=$2 granted=$3 result
  for _ in {1..40}; do
    result=$(db -Atc "SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING (pid)
      WHERE a.application_name = '$application' AND relation = 'public.articles'::regclass
        AND mode = '$mode' AND granted = '$granted';")
    if [[ "$result" == 1 ]]; then
      printf 'Observed articles lock: %s %s granted=%s\n' "$application" "$mode" "$granted"
      return
    fi
    sleep 0.15
  done
  return 1
}

{ cat "$registry" "$pilot"; printf '\nSELECT 1/0;\n'; } |
  expect_failure 'division by zero' db -q -1 -f -
[[ $(db -Atc "SELECT to_regclass('public.editorial_candidates') IS NULL
  AND to_regclass('public.articles_editorial_source_key_idx') IS NULL
  AND to_regclass('public.editorial_generation_pilot') IS NULL;") == t ]]
printf 'Aborted migration left no tables or index\n'

PGAPPNAME=stage-writer db -q <<'SQL' &
BEGIN;
INSERT INTO public.articles(title, slug, category, content, source_url, source_name)
VALUES ('Stage writer', 'stage-writer', 'Fixture', 'Text', 'https://source.invalid/writer', 'Fixture');
SELECT pg_sleep(4);
COMMIT;
SQL
writer=$!
wait_lock stage-writer RowExclusiveLock t

SECONDS=0
{ printf "SET LOCAL lock_timeout = '12s';\n"; cat "$registry" "$pilot"; printf '\nSELECT pg_sleep(3);\n'; } |
  PGAPPNAME=stage-migration db -q -1 -f - &
migration=$!
wait_lock stage-migration ShareLock f
wait "$writer"
wait_lock stage-migration ShareLock t
expect_failure 'statement timeout' db -q -c "SET statement_timeout = '350ms';
  INSERT INTO public.articles(title, slug, category, content, source_url, source_name)
  VALUES ('Contending writer', 'contending-writer', 'Fixture', 'Text', 'https://source.invalid/blocked', 'Fixture');"
wait "$migration"
printf 'Migration plus deliberate contention and holds took %s seconds\n' "$SECONDS"

db <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000010"}';
INSERT INTO public.articles(title, slug, category, content, source_url, source_name)
VALUES ('Admin writer', 'admin-writer', 'Fixture', 'Text', 'https://source.invalid/admin-write', 'Fixture');
UPDATE public.articles SET source_url = 'https://source.invalid/admin-update' WHERE slug = 'admin-writer';
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.articles(title, slug, category, content, source_url, source_name)
VALUES ('Service writer', 'service-writer', 'Fixture', 'Text', 'https://source.invalid/service-write', 'Fixture');
COMMIT;
ANALYZE public.articles;
SELECT count(*) AS catalog_rows FROM public.articles;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.articles
WHERE public.editorial_source_key(source_url) COLLATE "C" = 'catalog.invalid/story/25000';
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.articles
WHERE public.editorial_source_key(source_url) COLLATE "C" = 'source.invalid/absent';
SELECT pg_size_pretty(pg_relation_size('public.articles_editorial_source_key_idx')) AS index_size;
NOTIFY pgrst, 'reload schema';
SQL
