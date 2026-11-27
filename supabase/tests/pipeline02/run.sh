#!/usr/bin/env bash
# A complete isolated run. No env file, hosted database URL or cloud credentials are used.
set -euo pipefail
cd "$(dirname "$0")/../../.."
fixture=supabase/tests/pipeline02
pg_image=${PIPELINE_STAGE_PG_IMAGE:-postgres:15.19-bookworm}
deno_bin=${DENO_BIN:-deno}
network=marketrends-pipeline02-stage
pg_id=
rest_id=
network_id=
cleanup() {
  [[ -z "$rest_id" ]] || docker rm -fv "$rest_id" >/dev/null
  [[ -z "$pg_id" ]] || docker rm -fv "$pg_id" >/dev/null
  [[ -z "$network_id" ]] || docker network rm "$network_id" >/dev/null
}
trap cleanup EXIT

network_id=$(docker network create --internal "$network")
pg_id=$(docker run --pull=never -d --name marketrends-pipeline02-pg --network "$network" \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$pg_image")
for _ in {1..40}; do
  docker exec "$pg_id" pg_isready -q -U postgres && break
  sleep 0.25
done
docker exec "$pg_id" pg_isready -q -U postgres
db() { docker exec -i "$pg_id" psql -X -U postgres -v ON_ERROR_STOP=1 "$@"; }

bash "$fixture/bootstrap.sh" | db -q
db -Atc 'SELECT version();'
bash "$fixture/migration-check.sh"
db <<'SQL'
BEGIN;
\timing on
CREATE INDEX staging_index_timing_only ON public.articles
  (public.editorial_source_key(source_url) COLLATE "C");
ROLLBACK;
SQL

rest_id=$(docker run --pull=never -d --name marketrends-pipeline02-rest --network "$network" \
  -p 127.0.0.1::3000 -e PGRST_DB_URI=postgres://authenticator@marketrends-pipeline02-pg/postgres \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public \
  -e PGRST_JWT_SECRET=marketrends-local-fixture-secret-32-bytes-only postgrest/postgrest:v12.2.12)
# The internal network is the only PostgreSQL access path. Attach the REST
# proxy to the loopback-published bridge for the host-side Deno test.
docker network connect bridge "$rest_id"
endpoint=$(docker port "$rest_id" 3000/tcp)
[[ "$endpoint" == 127.0.0.1:* ]]
for _ in {1..40}; do
  curl --noproxy '*' --max-time 2 -fsS "http://$endpoint/" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --noproxy '*' --max-time 2 -fsS "http://$endpoint/" >/dev/null
PIPELINE_STAGE_API="http://$endpoint" "$deno_bin" test --cached-only --no-lock --node-modules-dir=none \
  --import-map="$fixture/import-map.json" --allow-env --allow-net="$endpoint" "$fixture/edge-staging_test.ts"

db -f - < "$fixture/registry-check.sql"
bash "$fixture/pilot-check.sh"
