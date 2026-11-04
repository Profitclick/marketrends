
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN ('mr-orchestrate-search-intents', 'mr-orchestrate-content');

COMMENT ON TABLE public.system_logs IS
  'Operational log. Retention policy: rows older than 30 days are pruned nightly by cron job mr-prune-system-logs. Failures, security events, publication events, duplicate decisions and scheduler outcomes are additionally summarised at run level in public.pipeline_runs, which has no automatic pruning.';
