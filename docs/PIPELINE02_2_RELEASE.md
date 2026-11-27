# PIPELINE-02.2 release reconciliation

Releasebranchen bygger på `230f8b229a511976261aa4a92a5b4d8a8b82fe6f` og integrerer `3cf4af21276e658db8258554b48380d2223db162` med ordinær merge. De to migrasjonene har Git-blobene `737accc1ad61f4ad1db22cad5d3282d4ff319d98` og `cd077a0465d2a2304a31fb0862a910d3e4757d53`.

- `ee59493` la til prosjektidentifikator, Supabase-URL og publiserbar nøkkel for servermiljøet, genererte to auth-moduler og økte Lovable Vite-wrapperen fra 2.27.3 til 2.28.0. Ingen service-role-variabel ble lagt til i .env. Generert middleware har ingen kallsteder. Den privilegerte klienten har ingen importører og leser nøkkelen ved bruk fra servermiljøet. Begge modulene og service-role-identifikatoren var fraværende fra de bygde offentlige filene.
- `cada959` deklarerte Vite- og Node-typer i appens tsconfig. Typekontroll besto.
- `230f8b2` synkroniserte Bun-lockfilen med 2.28.0. Frosset installasjon besto. Lockfile-korrigeringen er nødvendig for å installere den valgte wrapperen reproduserbart. Lokal verifisering fastslår ikke hvilke av endringene Lovables hostede preview krever.

## Backup og manuell aktivering

1. I Lovable Cloud, bekreft dato og status på siste fullførte daglige sikkerhetskopi. Dokumenter plattformens konkrete restore-prosedyre, hvem som kan utføre den og hvor mye aktivitet siden kopien som kan gå tapt. Bruk Lovables støttede restore-flyt eller få prosedyren bekreftet av Lovable-support. Stopp dersom gjenoppretting ikke kan bekreftes. PITR er valgfritt.
2. Repoet har både Supabase SQL-migrasjoner og Drizzle-konfigurasjon. Drizzle bruker `LOVABLE_DB_MIGRATION_URL` og sin egen journal under `drizzle/migrations/meta`. Disse to migrasjonene ligger i `supabase/migrations` og har ingen Drizzle-journaloppføring. Ingen repo-workflow ble funnet som anvender dem i Lovable. Bekreft med plattformoperatøren hvilken støttet mekanisme som kan kjøre eksakt SQL og føre de to versjonene i riktig journal. Kjør ikke et generelt push av hele migrasjonshistorikken.
3. Behold den tidligere Edge Function-versjonen klar for redeploy. Deploy den godkjente funksjonen med `EDITORIAL_CANDIDATE_REGISTRY_ENABLED=false`. Bruk et rolig skrivevindu og kjør begge originale SQL-filer i rekkefølge innenfor én transaksjon med `SET LOCAL lock_timeout = '3s'` og `SET LOCAL statement_timeout = '15s'`. Stopp og undersøk ved feil eller timeout. Ingen automatiske retries.
4. Bekreft gyldig uttrykksindeks, grants, RPC-tilgang og tom pilottabell. Slå flagget på etter godkjenning. Utfør én manuell admin-request med `{"registry_only":true}`. Verifiser registermålingene og null AI-kall, kladder og publiseringer. Behold eksisterende scheduler-kontrakt.
5. Ved avvik, slå flagget av, vent på aktive requests og redeploy tidligere Edge Function. La databaseobjektene stå dersom funksjonsrollback løser avviket. Ved særskilt godkjenning kan operatøren eksportere registerdata og kjøre `supabase/ops/revert_editorial_candidate_registry.sql`. Skriptet bruker én transaksjon og ingen CASCADE. Det sletter de nye register- og pilotobjektene og bevarer eksisterende tabeller og rader, inkludert journalhistorikken. Avstem migrasjonsjournalen med operatøren etter vellykket reversering. Bruk plattform-restore bare ved behov for bredere gjenoppretting.

## Verifisering og beslutning

- Frosset Bun-install, app/node-typekontroll og 101 deterministiske Bun-tester besto. Den separate testen for eksisterende produksjonsadmin manglet en administrert testsesjon.
- Full build med lokal REST-fixture og Cloudflare-preset besto. Ordinær build kompilerte frontend, SSR og Worker, men sitemap-steget fikk nettverksfeil mot konfigurert REST-kilde. Bygd Worker returnerte HTTP 200 med noindex for auth, admin og dashboard, og korrekt 404 på ukjent rute.
- Atomisk apply og reversering på isolert PostgreSQL 17.11 besto. Datafingeravtrykket for artikler, feeds og kjørselsjournal var identisk før apply og etter reversering. Testen kan gjentas med `bash supabase/tests/pipeline02/release-reversal.sh`.

GO for gjennomgang av releasebranchen. NO-GO for produksjonsaktivering inntil daglig backup, støttet restore- og migrasjonsflyt samt hostet build og administratortest er bekreftet.
