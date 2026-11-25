# MIGRATE-02.3A.7.4.2 – guard og offline-verifisering

Arbeidsbranch `diagnostics/migrate02-3a7-4-1` startet på `23f37fb88ea989aac99a0c01b2c7272fd1d7ad36`. Workflowen sjekker fortsatt ut recovery og evaluator eksakt på `091837a1a5b1ed2be2c41fcba2d6032f2dfc3395`.

| Finding | Implementasjon og verifisering |
| --- | --- |
| 01 | Guard måler fra HTTP-dispatch til første byte på en dedikert HTTP/1.1-forbindelse. Journalen beholder evaluatorens opprinnelige tid fra før guarden og tiden gjennom lesing av body. `http-timings.jsonl` lagrer HTTP-TTFB og guard-overhead per URL. Bare HTTP-TTFB brukes i vinduene på 25 målinger med uendret p95-grense på 5 000 ms i to påfølgende fulle vinduer. Manglende timing blokkerer også et ufullstendig vindu. Testene bruker Node HTTP-parseren med en socket i minnet og forsinkede headere og body. |
| 02 | Git-registeret bruker én ref under `refs/heads/diagnostics/migrate02-register/` per SHA-256 av recovery-SHA, snapshot-SHA og kildejournalens SHA-256. Samme checkpoint får samme nøkkel uavhengig av artifact-ID, ZIP-digest og batchstørrelse. Før bygg og prober opprettes `RESERVED` atomisk med en eksplisitt Git-lease på en fraværende ref. Bare eierens kjøring kan gå fra `RESERVED` til `PASS` eller `QUARANTINE`. Begge er terminale. `PASS` binder neste artifact-ID og SHA-256. Et avbrudd kan etterlate `RESERVED` permanent. Det finnes ingen automatisk frigivelse, utløpstid eller retry. Testene kjører konkurrerende Git-skrivinger fra separate prosesser mot et lokalt bare repository. |
| 03 | En subprocess-test bruker den faktiske audit-guarden, et lokalt register og en dummyprosess uten nettverk. Et RSS-brudd etter første dummyrespons gir nøyaktig ett probestartmerke, avslutter begge prosesser, skriver `QUARANTINE` og avviser både ny reservasjon av samme kilde og recovery fra karanteneevidensen. |
| 04 | En separat watchdog måler prosessene og tar ressursprøver hvert sekund, med en ekstra prøve før hver probe. Evaluatorprosessen sender egne sekvensnummererte heartbeat-meldinger. Manglende, foreldet eller hoppende telemetri stenger gaten. Lengste tillatte intervall er under 2 500 ms. Samme overvåking fortsetter gjennom eksisterende passivperiode på 120 sekunder. Subprocess-testene stanser evaluatorens event loop og simulerer en treg ressursmåling. |
| 05 | En rest på én URL gir batchstørrelse én. En verifisert fullført kilde gir tomt målsett og terminal evidens med null prober. Workflowen hopper da over reservasjon, bygg og kjøretid. Testen fullfører siste URL med evaluatorens injiserte dummyrespons og sjekker sluttkommandoen på den resulterende journalen. |

Workflowen har kun `workflow_call`. En eksplisitt godkjent caller på diagnostikkbranchen må sjekke ut den samme committen og gi `contents: write` og `actions: read`. GitHub-tokenet brukes for registerskriving bare i registerstegene. Reserverte register-ref-er må beholdes. Hvis terminal skriving feiler etter artifact-opplasting, er artifactet utilgjengelig som recovery-kilde fordi neste kjøring krever både vellykket kildeløp og et samsvarende `PASS` i registeret.

## Offline-verifisering

Bruk en ren checkout på den eksakte recovery-committen som arbeidskatalog, med diagnostikkbranchen i en separat checkout og det frosne kildeartifactet utpakket i en egen katalog.

```sh
SEGMENT_TEST_SOURCE_DIR=/path/to/source \
node --test --experimental-test-coverage scripts/full-sitemap-checkpoint.test.mjs \
  /path/to/guard-src/scripts/segment*.test.mjs
```

Node v24.22.3 rapporterte 48 beståtte tester uten feil eller hoppede tester. Samlet dekning i Node-testprosessen var 74,69 % linjer, 89,72 % grener og 88,89 % funksjoner. Målingen inkluderer ikke kode som bare kjøres i subprocessene. `actionlint` og `git diff --check` besto.

Frosset kildeartifact `15049826258` tilhører Actions-run `45669533453`. ZIP-arkivet pakket ut uten feil. Den nedlastede ZIP-ens SHA-256 var `ab7879472ec1ead511b26e5817b842a77debcc57526c4fb86afeb5d91ce89671`. Kilden hadde 1 321 beståtte URL-er og 1 324 journalrader. Denne verifiseringen opprettet ingen workflow-kjøring eller nytt Actions-artifact.

**Første live-segment har NO-GO.** Offline-testene dekker registeret mot en lokal Git-server og stopplogikken med dummyprosesser. Skriveadgangen for callerens GitHub Actions-token til registernavnerommet og samspillet med det isolerte SSR-miljøet gjenstår å verifisere under en separat godkjent kjøring.
