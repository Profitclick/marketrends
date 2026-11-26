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

Frosset kildeartifact `15049826258` tilhører Actions-run `45669533453`. ZIP-arkivet pakket ut uten feil. Den nedlastede ZIP-ens SHA-256 var `ab7879472ec1ead511b26e5817b842a77debcc57526c4fb86afeb5d91ce89671`. Kilden hadde 1 321 beståtte URL-er og 1 324 journalrader. Den lokale verifiseringen opprettet ingen workflow-kjøring eller nytt Actions-artifact.

## Verifisering på GitHub Actions

| Fase | Commit | Run-ID | Artifact-ID | Verifisert ZIP SHA-256 |
| --- | --- | --- | --- | --- |
| Reservasjonskonkurranse og karantene | `c43d6085de9034dd0b4c4a27c9a512ad39bce294` | [45703574107](https://github.com/Profitclick/marketrends/actions/runs/45703574107) | [15063219195](https://github.com/Profitclick/marketrends/actions/runs/45703574107/artifacts/15063219195) | `acc133c98c552e822e0a08e8e41775cc89f72156cb9aa35e7c0d21c00985bfdc` |
| Avslag på gjenbruk i separat kjøring | `6ea0a393b3afe0e6498acbfd1db84fcc5e97ad72` | [45703690298](https://github.com/Profitclick/marketrends/actions/runs/45703690298) | [15064685949](https://github.com/Profitclick/marketrends/actions/runs/45703690298/artifacts/15064685949) | `1d1122d97012cfc790b4940d3996fa53a42d81692dc6f033fdba8f8bc1d7bd0f` |

Begge kjøringer verifiserte kildeartifactets SHA-256 og besto 48 tester med null feil, null hoppede tester og null SSR-prober. Siste Node-rapport målte 74,69 % linjer, 89,79 % grener og 88,89 % funksjoner i testprosessen. ZIP-filene for begge kjøringer ble lastet ned og kontrollert separat.

Ett av to samtidige reservasjonsforsøk med Actions-tokenet vant på den syntetiske ref-en. Eierkjøringen satte den til `QUARANTINE`. Den andre Actions-kjøringen fikk avslag og bekreftet terminal commit `5e2be3db6264e5fc2ae4aab74386b3fdde1e6b8f`. Det frosne kildecheckpointets registernøkkel hadde ingen tilsvarende ref etter verifiseringen. `main` sto fortsatt på `71b3410d61b9a286845b2347a6fe35745396abbe` og `feat/tanstack-migration` på `091837a1a5b1ed2be2c41fcba2d6032f2dfc3395`.

**Offline-gate PASS. Første live-segment krever separat godkjenning.** Samspillet med den isolerte SSR-kjøretiden kan verifiseres i den første godkjente kjøringen. Foreslått omfang er én URL fra kildeartifact `15049826258`.

## Første isolerte live-segment

Det separat godkjente segmentet kjørte på `1a24a6959c698cf9d590dddd052c8d4636e0e2b5` med batchgrense én. [Actions-run 45704914324](https://github.com/Profitclick/marketrends/actions/runs/45704914324)

- Én GET ble registrert. HTTP 200 og null evaluatorfunn ga 1 322 beståtte URL-er av 5 276 og 1 325 journalrader. Runtime-loggen og journalen hadde én match, null manglende og null ekstra GET-er.
- HTTP-TTFB var 2 791,4 ms. Guard-overhead var 12,4 ms og evaluatorens totale tid 2 814 ms. Passiv observasjon var 120,008 sekunder med 122 prøver og et lengste måleintervall på 1 005 ms.
- ZIP-integritet og SHA-256 `0433ad4dfe9e1e8294824d1ac3fa9e0a502c0d755784cc48828252864f0c9752` ble verifisert etter nedlasting. Registercommit `80c7aa26ee1fe886b26fd508a7017501e4ff3fa8` har terminal `PASS` og binder denne digesten til artifactet. [Artifact 15065670674](https://github.com/Profitclick/marketrends/actions/runs/45704914324/artifacts/15065670674)
- Kildecheckpoint `15049826258` er konsumert. En eventuell videre separat godkjent recovery må bruke `15065670674`. Dette enkeltsegmentet godkjenner bare én URL. Ingen oppskalering ble startet.

## Videre segmenter og terminal stopp

Åtte påfølgende segmenter med batchgrense 50 besto. Hvert segment hentet kildeartifactet fra forrige vellykkede kjøring og kontrollerte SHA-256 før reservasjon. Siste beståtte kjøring, `45726921919`, ga 1 722 beståtte URL-er av 5 276 og 1 725 journalrader. ZIP-arkivet ble separat verifisert med SHA-256 `f6bc8bbe523941a018cbb0e955106a2c3a3ee49ba406342684521fcb966fe27e`. [Siste beståtte artifact 15075535537](https://github.com/Profitclick/marketrends/actions/runs/45726921919/artifacts/15075535537)

Kjøring `45727419195` på `3a403fbe86fbebad3129657b920a26c5e0b1b3cc` reserverte dette checkpointet og stanset før første probe med `WORKER_IDENTITY_CHANGED`. Karanteneevidensen viser null probestarter, null HTTP-timinger og null nye journalrader. Den første ressursprøven er bevart. Den avviste prøven ble ikke lagret, så evidensen fastslår ikke hvorfor worker-identiteten endret seg. SHA-256 for karantene-ZIP var `9fbacb4465d44811e04c8aa1ea15bba4c0b737681bccfd6acbf827010e1de6f3`. [Karanteneartifact 15074449808](https://github.com/Profitclick/marketrends/actions/runs/45727419195/artifacts/15074449808)

Registercommit `1a17246abc3391fa6a416ceb91e0b6e4d1f63da0` bekrefter terminal `QUARANTINE` for kildeartifact `15075535537`. Kontrollprosessen avsluttet kjeden med 3 554 URL-er igjen. Ingen retry eller senere segment ble startet. `main` og `feat/tanstack-migration` ble verifisert uendret.
