# Database recovery

- [x] Repair authenticated news scheduling and verify a live no-AI collection run (fetch_only, 7 feeds, 35 items, 0 AI calls).
- [x] Seed canonical vocabulary + cluster seeds on the live database; deterministic pass over all published articles; rebuild clusters, internal links, authority.
- [ ] Restore historical records from the previous database — requires access to its exported records.
- [ ] Switch scheduler from fetch_only to full processing — waits on AI credits and explicit approval.
- [ ] P1 AI enrichment of hybrid_pending/ai_required articles — waits on AI credits.
- [ ] Connect marketrends.no — waits on the user's domain DNS.
