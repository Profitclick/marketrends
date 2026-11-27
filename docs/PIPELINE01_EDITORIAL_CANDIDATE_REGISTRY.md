# PIPELINE-01 — kandidatregister og manuell genereringskontrakt

Produksjonsbaseline `e1e00c0031a6215d1fe8c0154c24bf91fb431172`. Arbeidet er isolert på `feat/pipeline-01-candidate-registry`. Kildetilstanden er verifisert mot repositoryets funksjoner og migrasjoner. Anslagene fra Lovable om ni aktive feeds, timevis cron, 15 kladder, lengden på fem utkast og aktiv GSC-observasjonsmodus er driftsobservasjoner. Denne verifiseringen leste ikke produksjonsdatabasen eller cron-katalogen.

## Verifisert utgangspunkt

- `fetch-and-process-feeds` leser maks sju aktive feeds etter `last_fetched` og parser maks fem elementer per feed. `fetch_only: true` journalfører antall innsamlede elementer og HTTP-status per feed, oppdaterer `last_fetched` og returnerer før artikkel-deduplisering og AI. Neste batch kan telle samme kilde på nytt. `pipeline_runs` har kjøringshistorikk og lås, mens `duplicate_decisions` registrerer semantiske vurderinger. Ingen av dem representerer kildeidentitet, observasjoner per feed og kandidatstatus over tid.
- Artikkelskjemaet har `source_url` og historisk en ikke-unik indeks for eksaktsøk. Den eldre skriveruten sjekker rå URL og et begrenset `ILIKE`-utvalg før gateway-kallet. `normalizeUrl` i `_shared/semantic.ts` fjerner hele queryen og gjør hele banen til små bokstaver. Registeret må bevare query-verdier og sensitivitetsforskjeller som kan identifisere forskjellige kilder. Ingen endring i den delte eldre normaliseringen.
- `maxArticlesPerRun: 8` teller vellykkede artikkelinnsettinger, mens request-feltet `limit` tidligere manglet i handleren. Den eldre gateway-integrasjonen bruker Lovable chat completions med inntil tre forsøk per kildeartikkel og har egne semantic/enrichment-steg. `enrich-article` leser tokenfelter og gatewayens `cost`/`credits`. Den eldre nyhetsskriveren regner ikke disse som kostnadsdata i run-rapporten.
- `publish-eligibility.ts` krever blant annet minst 450 ord, 800 tegn kildegrunnlag og eksplisitt publiseringsvalg. I baselinen refererte handleren til `cleanContent` utenfor funksjonen som deklarerte variabelen. Rettelsen kobler porten til den samme kildeevidensteksten som brukes før generering. Ingen terskel eller regel er endret.

## Register og lagring

Migrasjonsfilen oppretter `editorial_candidates` og `editorial_candidate_observations`. Kandidat-ID er SHA-256 av én normalisert kilde-URL. Den samme SQL-funksjonen brukes for både observasjoner og søk i `articles`, inkludert upubliserte kladder. Den normaliserer skjema, `www.`, standardport, én avsluttende skråstrek og fragment, og fjerner en avgrenset liste med kjente sporingsparametere. Banens tegn og rekkefølgen på øvrige query-parametere beholdes. Endepunktet følger ingen artikkellenker og utleder ingen ekvivalens mellom ulike nettadresser for samme hendelse. Et ikke-unikt uttrykksindeks i `articles` gjør oppslaget uten å kreve at eldre duplikater fjernes.

Hver unik kilde får `first_seen`, `last_seen` og en beslutning for siste observasjon. Per kjøring, kilde og feed lagres feed-ID, feednavn, tittel, publiseringstidspunkt, eksisterende pre-score, målt mengde kildegrunnlag, reason code og antall gjentakelser. Et reelt artikkeltreff har forrang. Ved flere observasjoner i samme batch velges kvalifisert evidens først, deretter pre-score, evidenslengde og publiseringstid med stabile tie-breakere. RSS-bilder og kildebrødtekst lagres ikke. Ugyldige URL-er har ingen kandidat-ID og registreres som `invalid_source_url` i kjøringen.

Reason codes for identifiserbare kilder er `qualified`, `existing_article`, `missing_title`, `invalid_pre_score`, `invalid_publication_time`, `insufficient_evidence` og `below_pre_score`. Kvalifisering krever gyldig tittel og publiseringstid, pre-score minst 0,55 og minst 800 tegn kildegrunnlag. Kildegrunnlaget må verifiseres på nytt før senere generering. Kandidater kan inspiseres av databaseoperatøren via `editorial_candidates` og `editorial_candidate_observations`, med join på kandidat-ID. Ingen ny lesetilgang gis til nettleseren.

En enkelt transaksjon lagrer batch og hash i `pipeline_runs`. Identisk replay returnerer forrige måling. Endret payload under samme kjørings-ID og ukjent eller inaktiv feed-proveniens avvises. Uavklart skriveutfall regnes som feil, og batchen kaller aldri gatewayen. Processering er begrenset til 35 elementer og 150 000 byte per SQL-batch. Tabelltilgang og muterende RPC-er er begrenset til service role og eier. RLS er aktivert på de nye tabellene i den forberedte migrasjonen.

Observasjoner kan slettes etter 30 dager. Kandidater uten nyere observasjoner kan slettes etter 30 dager, med minst 90 dagers bevaring av reservasjoner. Den manuelle rydde-RPC-en tar maks 500 av hver radtype per kall. Ingen automatisk ryddejobb installeres. En identitet uten gjenværende artikkel eller historikk kan bli ny ved gjeninnsamling etter retention. Kjørejournalen beholder kun målinger og batchmarkør etter sletting, med den eksisterende journalens retention.

## Måling

| Felt | Betydning i en registerkjøring |
| --- | --- |
| `rss_observations` | Antall parsede feed-elementer i det begrensede utvalget, inkludert gjentakelser og ugyldige URL-er |
| `unique_source_articles` | Unike normaliserte kilder i denne batchen |
| `new_candidates`, `known_candidates` | Første registrering og allerede kjent kandidat, inklusive kandidater med artikkeltreff |
| `qualified_candidates`, `rejected_candidates` | Kvalifisering av unike identifiserte kandidater i batchen |
| `unidentified_observations` | Observasjoner uten gyldig identitet, separat fra avviste identifiserte kandidater |
| `ai_calls`, `drafts_created`, `published_articles` | Null i registermodus. Kontrakten teller gateway-forsøk og bekreftede kladdeskrivinger separat |

`PublishingStats` kaller i dag opprettede artikler gruppert på `source_name` for «RSS Feed Helse». Farge og beskrivelsen «produserer innhold» bygger på syvdagers artikkelantall, og spørringen inkluderer kladder. En feed-only periode kan derfor se syk ut mens HTTP-innsamlingen fungerer. Minste UI-endring er å kalle denne målingen «Artikler opprettet per kilde, 7 dager» og fjerne helsefargen. Vis siste observerte HTTP-status fra kjørejournalen ved siden av hvis helsemåling trengs, med «Ingen måling» når feeden ikke var med i batchen. Bruk feed-ID, og ikke behandle `last_fetched` alene som suksess. `CronJobMonitor` baserer seg på loggtyper og hardkoder 30 minutter. Vis faktisk siste måling og status fra `pipeline_runs` fremfor å utlede tidsplan fra denne etiketten. Ingen UI- eller GSC-endring inngår her.

## Genereringskontrakt og senere aktivering

1. Behold `EDITORIAL_CANDIDATE_REGISTRY_ENABLED` avslått. Planlagt `fetch_only` har samme kontrakt og skriver ingen kandidatdata. Manuell generering via den nye kontrakten er foreløpig frakoblet. En genereringsrequest med `limit` eller `candidate_ids` avvises av den gamle handleren fremfor å falle videre til den eldre generatormodusen.
2. Etter separat godkjenning, test migrasjonen på isolert staging med riktig PostgreSQL-versjon, de virkelige grants og en representativ artikkelmengde. Kontroller kostnaden ved å bygge uttrykksindeksen, både rollegrensene og rollback av endepunktet. Aktiver så kun registermodus i staging, bruk innlogget admin og den eksakte requesten `{"registry_only":true}`. Kontroller nye/kjente kandidater, årsaker og null AI-kall ved to kjøringer. Deaktiver med env-flagget ved avvik. Avklar manuell retention før en eventuell produksjonsaktivering.

Den gjennomførte stagingverifiseringen og den reversible aktiveringsprosedyren er dokumentert i [PIPELINE02_1_REGISTRY_ACTIVATION.md](./PIPELINE02_1_REGISTRY_ACTIVATION.md).
3. Senere manuell generering krever separat godkjenning og faktiske adaptere for kildeverifikasjon, gateway og kladdelagring. Frys én liste med én eller to unike eksplisitte kandidat-ID-er, `limit: 2` og `auto_publish: false`. SQL-reservasjonen kontrollerer alle valgte rader, maks 24 timer siden siste kvalifiserte observasjon, fravær av eksisterende artikkel og at ingen er reservert. Reservasjonen er atomisk for hele listen og frigjøres ikke automatisk ved avbrudd. Kontroller fersk kildeevidens og brukstillatelse for hele listen før første gateway-forsøk. Blokker parallelle eldreskrivere under piloten, og bruk samme normaliserte kildeidentitet og atomisk dublettkontroll ved kladdelagring. Kontroller at kilde/AI-tekstadapterne ikke har skjulte retries, embeddings eller berikelsesfan-out.
4. Budsjettet er maks to unike kilder, to gateway-forsøk, null retries, to bekreftede kladder og null publiseringer. Ved første gateway-feil eller uavklart skriving stopper hele kjøringen. Alle kladder lagres med `published: false` og `image_url: null`. Utgivelse går gjennom de eksisterende publiseringsportene. Journalfør gatewayens rapporterte `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost` og `credits` per forsøk når de finnes. Uteblitte verdier står som `null`; tallene tilordnes ingen valuta uten dokumentasjon. Det finnes ingen observerte providerkostnader for denne leveransen.

## Verifikasjon

Resultat for denne leveransen er 25 av 25 Deno-tester og 101 av 101 offline repo-regresjoner. Typekontroll av app, Vite-konfigurasjon og RSS Edge Function besto.

```sh
deno test --cached-only --no-lock --node-modules-dir=none --allow-read \
  supabase/functions/fetch-and-process-feeds supabase/tests/editorial-candidate-registry_test.ts
deno check --cached-only --no-lock --node-modules-dir=none supabase/functions/fetch-and-process-feeds/index.ts
npm run typecheck
npx tsc -p tsconfig.node.json --noEmit
find scripts -maxdepth 1 \( -name '*.test.ts' -o -name '*.test.mjs' -o -name '*.test.js' \) \
  ! -name 'production-access.test.ts' -print0 | xargs -0 bun test
```

Fyll Deno-cache for de oppgitte testfilene ved behov før offlinekjøringen. SQL-testene bruker PGlite med en ny PostgreSQL-instans i minnet og det minste avhengige fixtureskjemaet. Ingen produksjonsforbindelse, lokal vedvarende database, AI-nøkkel eller RSS-forbindelse brukes. Produksjonsrelease-evidensen er uendret. En full sitemap-test ble ikke gjentatt.
