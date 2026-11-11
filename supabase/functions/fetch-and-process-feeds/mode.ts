export function ingestionMode(body: Record<string, unknown>) {
  return {
    dryRun: body.dry_run === true,
    fetchOnly: body.fetch_only === true,
    autoPublish: body.auto_publish === true,
  };
}