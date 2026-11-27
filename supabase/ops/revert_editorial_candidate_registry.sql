-- Operator only. Disable registry and quiesce requests before running.
-- Export registry data first if it must be retained. No CASCADE or retries.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DROP FUNCTION public.reserve_editorial_generation(uuid, uuid, jsonb);
DROP FUNCTION public.prune_editorial_candidate_registry();
DROP FUNCTION public.claim_editorial_candidates(text[]);
DROP FUNCTION public.record_editorial_candidate_batch(uuid, jsonb);
DROP TABLE public.editorial_generation_reservations;
DROP TABLE public.editorial_generation_pilot;
DROP TABLE public.editorial_candidate_observations;
DROP TABLE public.editorial_candidates;
DROP INDEX public.articles_editorial_source_key_idx;
DROP DOMAIN public.editorial_candidate_reason;
DROP FUNCTION public.editorial_source_key(text);
COMMIT;
