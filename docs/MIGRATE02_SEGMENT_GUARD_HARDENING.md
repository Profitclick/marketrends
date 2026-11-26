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

## Godkjent engangsvidereføring etter stopp før første probe

26. november 2026 ble ett unntak godkjent for kildeartifact `15075535537` etter stoppet i kjøring `45727419195`. Begge ZIP-digestene er låst i verifiseringen. Kilde- og karanteneevidensen har identiske bytes for snapshot, checkpoint, journal og resultateksport. Karanteneevidensen har ingen probestart, ingen HTTP-timing, null forespørsler i runtime-avstemmingen og en terminal stopp før første probe. Det opprinnelige registeret forblir terminalt på `1a17246abc3391fa6a416ceb91e0b6e4d1f63da0`. En særskilt deterministisk reservasjonsnøkkel er bundet til akkurat dette originalcheckpointet og denne karantenecommitten. Git avviser ny reservasjon av begge brukte nøkler.

Før evaluatorprosessen kan starte, må workerd-identiteten holde seg stabil i fem sekunder. Readiness er avgrenset til 20 sekunder og bruker eksisterende RSS-, minne-, OOM- og telemetrigrense. Etter at identiteten er låst, går enhver endring til karantene. Ved avvist ressursprøve lagres både målingen og forventede worker-identiteter. Videre segmenter har fast grense på 250, med kortere siste segment om nødvendig.

Oppstartsrettingen ble pushet på `60de9aa32f083098bc05ff426b71d62fc8877c4a`. Alle 53 offline-tester besto mot det frosne kildeartifactet. Første hosted klargjøring `45729731599` arvet karanteneinnstillingen i testprosesser og stanset før reservasjon, bygg og prober. Commit `8e0490432566a72bd7f31a4085a5fe2652aea18f` begrenser innstillingen til klargjøringskommandoen. En lokal gjennomkjøring med samme kildedata bootstrappet den godkjente planen på 250 med null testfeil.

Fire 250-segmenter besto etter dette. Første run `45729956323` benyttet engangsunntaket. Artifact `15077090224` viste 250 beståtte prober, 5 026 ms med stabil worker-identitet før første probe og 120 sekunder passiv observasjon. SHA-256 `d1f4673bdaa65eff6b805ca37c96e3eed657054bd133521448cd543714f63371` ble verifisert etter nedlasting. De tre neste segmentene benyttet ordinær reservasjon. [Første beståtte kjøring](https://github.com/Profitclick/marketrends/actions/runs/45729956323)

Det femte segmentet, run `45733508942` på `314467c13149946c3b1637717aa609c9927f013f`, endte med `SEGMENT_NOT_PASS`. Alle 250 prober var avstemt mot runtime-loggen. 249 rader besto, og artikkelen `/arm-sterk-ettersporsel-baksettes-av-produksjonskapasitet` ga HTTP 200 med `ARTICLE_HEADLINE_MISMATCH`. Artifactet oppgir H1 og tittelen, men inneholder ikke den strukturerte `NewsArticle.headline`-verdien. Rotårsaken til avviket er derfor uavklart. Karanteneartifact `15078471519` ble verifisert med SHA-256 `5e6cf4312d4dffbd6c227357e74912f2cc46ce16f76d75c921e641cfe0979ec0`. [Karanteneartifact](https://github.com/Profitclick/marketrends/actions/runs/45733508942/artifacts/15078471519)

Registercommit `cfb4cc9cba955df691c69bd2bc0fd25cda3f8c6e` sperrer kildeartifact `15077387574`. Dette var siste verifiserte PASS, med 2 722 av 5 276 beståtte URL-er. SHA-256 var `f81ab484eb3e7b6dd13e3b81790e259cb4174d9d4f390430e1ec81a68294ab8a`. 2 554 URL-er gjenstår i den godkjente inventarstatusen. Det godkjente engangsunntaket er brukt. Ingen retry eller senere segment ble startet. Begge beskyttede brancher og den eksakte recovery-revisjonen ble verifisert. [Siste beståtte artifact](https://github.com/Profitclick/marketrends/actions/runs/45732598155/artifacts/15077387574)

## Godkjent utgangspunkt med 2 971 beståtte URL-er

Et skrivebeskyttet oppslag av den publiserte artikkelen fant den lagrede tittelen `ARM: Sterk  etterspørsel baksettes av produksjonskapasitet` med to mellomrom etter «Sterk». Den eksakte recovery-revisjonen bruker tittelen direkte i JSON-LD, mens evaluatoren slår sammen mellomrom ved lesing av H1. En offline-fixture reproduserte nøyaktig `ARTICLE_HEADLINE_MISMATCH` og viste at én normalisering av mellomrom fjerner avviket. Ingen databasetittel ble endret.

Brukerens godkjenning gjelder evidensgrunnlaget. Den nye journalen bevarer alle 250 forsøk fra det siste segmentet og alle tidligere forsøk. Den verifiserte inventory-statusen er 2 971 bestått, én feil og 2 304 uprøvde URL-er. ARM-artikkelen er første uavklarte URL. Karantenecommit `cfb4cc9cba955df691c69bd2bc0fd25cda3f8c6e` er fortsatt terminal. Den nye journalen har en egen checkpointnøkkel.

Den offline workflowen publiserer checkpointet sammen med en separat `APPROVED_BASELINE`-manifest. Checkpointet er utgangspunkt for videre godkjent recovery, med nøyaktig 2 305 uavklarte URL-er. Eksisterende live-workflow håndterer PASS-artifacts med null åpne feil. Før neste live-segment må tittelen korrigeres og live-verifiseringen eksplisitt støtte den godkjente journalen og den historiske feilraden. Godkjenningen her reserverer ingen kilde og starter ingen SSR-prober.

Offline-kjøring `45738081755` på `496654cdcb924729bd1d45b018e3ea90a17d325e` besto. ZIP-arkivet ble lastet ned og verifisert byte for byte mot den lokalt bygde pakken. SHA-256 var `617a815c2dc26b0449ef4d5a83e0d4152b61382b992dc5286483585b9cbcf688`. [Godkjent baseline-artifact 15080475107](https://github.com/Profitclick/marketrends/actions/runs/45738081755/artifacts/15080475107)
