# PIPELINE-02.1 — staging og aktivering av kandidatregister

Staging startet fra `754e504ae7a2d5eb76b1fb4a0bc07c131de02693` på `feat/pipeline-01-candidate-registry`. Produksjonsbaseline er `e1e00c0031a6215d1fe8c0154c24bf91fb431172`. Endringen forbereder et persistent pilotbudsjett og strengere kildeverifisering. Registerets schema og Edge-rute fra PIPELINE-01 er uendret. Registeret er ikke aktivert i produksjon.

## Isolert evidens

Docker-staging bruker ekte PostgreSQL med interne nettverk, PostgREST 12.2.12 på loopback og reelle relevante SQL-definisjoner fra repositoryet for `articles`, `rss_feeds`, adminpolicyer og `pipeline_runs`. Auth-tjenesten og RSS-svarene er fixtures. Deno kjører den ordinære Edge-handleren, med testadapter kun for å kalle handleren uten en egen HTTP-server. Deno får nettverkstilgang kun til PostgREST-porten. Ingen gateway, produksjonsbruker, produksjonsdatabase, cron eller deploy inngår. Dette verifiserer de relevante skjemaavhengighetene og representativ Data API-oppførsel, med en avgrenset kopi av repositoryets migrasjonshistorikk.

- PostgreSQL 15.19 og 17.11 verifiserte 50 005 fiktive artikkelrader etter skriveprøvene. En injisert feil rullet tilbake begge migrasjoner sammen med indeksen. Katalogtesten bekreftet RLS og grants. PostgREST nektet direkte tabell- og RPC-tilgang for anonym, autentisert og admin med nettleserrolle. En admin kunne fortsatt sette inn en artikkel og oppdatere kilde-URL-en gjennom eksisterende RLS, og service role kunne fortsatt sette inn artikler. Service role har RPC-tilgang til registrering og reservasjon, men kan ikke utstede, nullstille eller slette pilotbudsjettet.
- Standard `CREATE INDEX` ventet med `ShareLock` på en aktiv skriver og blokkerte deretter nye skrivinger til commit. En konkurrerende fixture-skriving ble avbrutt ved 350 ms. I separat ubelastet PostgreSQL 15-måling tok indeksbyggingen ca. 8,2 sekunder og indeksen ble 2 456 kB. Begge representative planer brukte `Index Scan` uten å slå av sekvensielt søk. Målt utføringstid var 0,059 ms ved treff og 0,009 ms uten treff.
- Identisk batch-replay returnerte samme måling og opprettet ingen observasjon. Endret replay og ukjent/inaktiv feed ble avvist. En injisert feil etter batchskriving rullet tilbake både kandidat, observasjon og batchmarkør. En parallell registerrequest fikk HTTP 409 mens den første ble holdt åpen. Registrering opprettet ingen artikler, bekreftet med uendret artikkelantall. Ordinær `fetch_only` beholdt responsfeltene, journalførte seks elementer og skrev ingen kandidatobservasjoner.
- Repositoryet dokumenterer 30-dagers opprydding av `system_logs` og ingen automatisk opprydding av `pipeline_runs`. Ingen katalog i produksjon ble lest. `ON DELETE RESTRICT` blokkerte manuell sletting av en journalrad med observasjoner. Etter observasjonsrydding kunne journalraden slettes. Testen beholdt en 45 dager gammel reservasjon og fjernet den utløpte kandidaten etter 91 dager. Den eksisterende fremmednøkkelen beholdes.

| Observerte målinger | Første batch | Gjentatt batch |
| --- | ---: | ---: |
| RSS-elementer | 6 | 6 |
| Unike kildeartikler | 4 | 4 |
| Nye kandidater | 4 | 0 |
| Kjente kandidater | 0 | 4 |
| Kvalifiserte | 2 | 2 |
| Avviste | 2 | 2 |
| Ugyldige kilde-URL-er | 1 | 1 |
| AI-kall, nye kladder og publiseringer | 0 / 0 / 0 | 0 / 0 / 0 |

Gjentakelsen på tvers av feeds ble én kandidat med to feedobservasjoner per kjøring. Avvisningene var treff på én eksisterende publisert artikkel og én eksisterende kladd.

## Fremtidig manuell pilot

`last_seen` angir innsamlingstid. En nylig observert kilde fra 90 timer tilbake kunne kvalifiseres for registeret, men ble avvist av piloten. For piloten kreves en kvalifisert RSS-observasjon innen 24 timer, feedens og den uavhengig bekreftede kildens publiseringstid innen 72 timer, og kildeverifikasjon innen 15 minutter. Tidsvinduene er valgt som konservative pilotgrenser. Kildeadapteren må bekrefte tekstgrunnlag, kanonisk identitet, redaksjonell vurdering og rettigheter før reservasjon. Avvik stopper hele utvalget før gateway.

Databaseeierens singleton-autorisasjon identifiserer maks to tillatte kandidater og utløper innen 24 timer. Migrasjonen oppretter ingen autorisasjon. Den nye RPC-en erstatter service roles tilgang til den gamle, ubudsjetterte claim-RPC-en. Transaksjonen sjekker autorisasjon, replay, restbudsjett, kandidat, aktualitet og artikkelduplikater før den reserverer hele utvalget. Unike plasser 1 og 2 gir en fysisk øvre grense. Avbrutt eller uavklart kjøring etter reservasjon frigjør ingen plasser. Retention av registrerte kandidater påvirker ikke pilotjournalen.

To samtidige databaseforbindelser demonstrerte serialisering og reserverte én plass hver. Identisk og endret request-replay ble avvist, og tredje forespørsel ble avvist med uttømt budsjett. Tilbakekalt autorisasjon, gammel eller udatert kilde og foreldet evidens ble avvist. Ingen gateway-adapter eller produksjonsgenerator er koblet til. Før en senere separat pilotgodkjenning må kladdeskriverens atomiske deduplisering og fravær av parallelle eldre skrivere verifiseres.

## Produksjonsprosedyre etter separat aktiveringsgodkjenning

1. **Preflight.** Bekreft eksakt godkjent kode og målmiljø, PostgreSQL-versjon, relevant schema/grants, journalens faktiske retensjonsjobber, artikkelvolum og gjenopprettingspunkt. Avtal et rolig skrivevindu. Stopp før DDL ved uventet skjema, pågående artikkelskriving eller andre journaljobber som krever sletting av fremdeles refererte rader.
2. **DDL.** Bruk miljøets godkjente migrasjonsløp for eksakt `20261127042841_editorial_candidate_registry.sql` og deretter `20261127044853_editorial_generation_pilot.sql`. Den andre migrasjonen gir tom pilotsikring og sperrer service roles gamle claim. Bruk en felles transaksjon med `lock_timeout` på 3 sekunder og start med `statement_timeout` på 15 sekunder som øvre grense per utsagn. Avbryt og gjennomgå lås/volum ved timeout. Bekreft funksjonenes grants, gyldig indeks, PostgREST-schema og at pilottabellen er tom før flagget kan slås på. Registrer begge migrasjonsversjonene i miljøets migrasjonsjournal.
3. **Aktivering og kontroll.** Distribuer bare den godkjente RSS-funksjonen med `EDITORIAL_CANDIDATE_REGISTRY_ENABLED` av. Sett flagget til eksakt `true` etter DDL-kontroll. Som innlogget admin, send bare `{"registry_only":true}`. Kjør to avgrensede manuelle batcher. Kontroller i `pipeline_runs` for hver returnerte ID at `details.ai_calls`, `details.drafts_created` og `details.published_articles` alle er 0. Kontroller artikkel- og kladdeantall før og etter i det avtalte skrivevinduet. Sammenhold nye/kjente kandidater, observasjoner, avvisninger og feedstatus. Bekreft at ordinær `fetch_only` fortsatt gir sin eksisterende respons. La pilotautorisasjonen være tom.
4. **Retention.** Operatøren kjører `prune_editorial_candidate_registry()` manuelt etter godkjent retentionintervall og logger antall. Funksjonen tar opptil 500 gamle observasjoner og 500 kvalifiserte sletterader om gangen. Observasjoner utløper etter 30 dager, kandidatreservasjoner bevares minst 90 dager. Hvis journalretensjon senere innføres, rydd observasjonene først og behold rader som er referert. Ingen ny cron-jobb.
5. **Deaktivering og rollback.** Sett flagget til `false` eller fjern det. Vent på eventuelle pågående registerrequests og verifiser at nye requests avvises. Ved funksjonsfeil gjenopprett forrige RSS Edge-versjon, med flagget av. Behold tabeller og journal for gjennomgang. Eventuell fjerning av schema eller indeks er et separat DBA-steg etter arkivering og avhengighetssjekk. Frontend og SSR-release omfattes ikke av rollbacken.
6. **Scheduler.** Eksisterende scheduler fortsetter med `fetch_only`. Planlagt registrering krever egen godkjenning, lastmåling, eksplisitt scheduler-policy for kun registerskriving og fornyet kontroll av null gateway/kladd/publisering. Denne endringen åpner registermodus kun for en admin.

## Reproduserbar staging

Last Docker-imagene og Deno-avhengighetene før offline testen. Kjør fra repositoryet med lokalt Docker og Deno. Runneren oppretter og fjerner egne testcontainere og tar ingen database-URL som argument.

```sh
docker pull postgres:15.19-bookworm
PIPELINE02_POSTGRES_IMAGE=postgres:17.11-alpine bash supabase/tests/pipeline02/run.sh
docker pull postgrest/postgrest:v12.2.12
bash supabase/tests/pipeline02/run.sh
deno test --cached-only --no-lock --node-modules-dir=none --allow-read \
  supabase/functions/fetch-and-process-feeds supabase/tests/editorial-candidate-registry_test.ts
```

26 Deno-fixture- og regresjonstester, 101 offline repo-regresjoner og typekontroll for app, Vite og RSS Edge Function besto. Ingen full SSR-audit ble kjørt.
