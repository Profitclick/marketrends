# A01.3 TanStack Start HTTP feasibility

Read-only production-safety experiment for Marketrends AUDIT-01.

This subproject does **not** replace the production React/Vite app and is not deployed by default. It exists to prove or disprove one narrow technical hypothesis in a production-mode TanStack Start + Nitro server:

- unmatched public paths can return real HTTP 404;
- missing dynamic resources can return real HTTP 404;
- legacy `/cluster/ai` can return HTTP 308 with `Location: /ai`.

The fixture slugs mirror representative AUDIT-01 route classes only. They are not a substitute for production data integration.

Run:

```bash
npm install --no-package-lock
npm run build
PORT=3000 npm start
npm run verify:prod
```

Acceptance is binary: all raw HTTP checks in `verify.mjs` must pass before this framework is considered technically capable of closing A01-P0-01 through A01-P0-04.

No database, DNS, sitemap, production hosting, or live content changes are part of this experiment.
