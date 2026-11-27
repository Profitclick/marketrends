#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
container=$(docker run -d --rm --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.11-alpine)
trap 'docker stop "$container" >/dev/null' EXIT
db() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"; }
for i in {1..30}; do
  docker exec "$container" pg_isready -U postgres >/dev/null && break
  sleep 1
done
bash supabase/tests/pipeline02/bootstrap.sh | db
db -c "INSERT INTO public.pipeline_runs(job_name) VALUES ('release-reversal-fixture')"
fingerprint() {
  docker exec "$container" pg_dump -U postgres --data-only -t articles -t rss_feeds -t pipeline_runs |
    sed -E '/^\\(un)?restrict /d' | sha256sum
}
before=$(fingerprint)
{
  echo "BEGIN; SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '15s';"
  for file in supabase/migrations/20261127042841_* supabase/migrations/20261127044853_*; do
    cat "$file"
    echo
  done
  echo 'COMMIT;'
} | db
db -f - < supabase/ops/revert_editorial_candidate_registry.sql
test "$(fingerprint)" = "$before"
db -Atc "SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND (relname LIKE 'editorial_%' OR relname = 'articles_editorial_source_key_idx')" | rg '^0$'
echo 'Protected data fingerprint matched'
