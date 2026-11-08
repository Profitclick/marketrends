# Phase 7C — målbar søkeinnsikt og ferskt nyhetsnettkart

## Verifisert utgangspunkt
- Search Console er nå koblet til prosjektet. Google returnerer én verifisert eiendom: `sc-domain:marketrends.no`.
- Forespørsel etter komplette måledager 8. august–5. november returnerte ingen rader. Dette betyr manglende målegrunnlag i denne forespørselen, ikke bevis for manglende indeksering eller trafikk.
- Databasen har 4 454 publiserte artikler; nyeste er publisert 8. november kl. 05:00 UTC. Det publiserte nyhetsnettkartet har 91 oppføringer og stopper ved kl. 00:00 UTC. Nyhetsinnhenting oppdaterer altså ikke den publiserte filen automatisk.
- Eksisterende etterspørsels-, trend- og autoritetsverdier er interne signaler. Ingen eksisterende GSC-faktatabell er funnet.
- Internlenkefunksjonen behandler maksimalt 500 artikler. SearchAction peker mot en ikke-verifisert søkerute; TopicPage lager FAQ-markup fra artikkeltitler og beskrivelser.
- Tre planlagte jobber er aktive: nyhetsinnhenting, klyngeoppdatering og åpne data. Ingen masseorkestreringsjobb er registrert som aktiv.

## 1. Ekte Google-målinger, separat fra interne signaler
- Opprett privat rådatagrunnlag og synkroniseringsstatus; behold rå Google-URL og normalisert canonical URL.
- Hent data daglig, med første historiske innhenting og kort overlapp for korrigerte dager. Bruk idempotente nøkler og behold målesettets dimensjoner og rapporteringsstatus.
- Skill side-/spørringsdata fra sidetotaler, slik at skjulte spørringer og dimensjonsoppdeling ikke gir doble eller misvisende totaler. Dokumenter Googles begrensninger i hvilke rader API-et returnerer.
- Lagre bare reelle tall. Ingen eksempelrader, ingen oppdiktet søkevolum eller AI-synlighet.
- Vis OBSERVATION_ONLY ved svakt eller ufullstendig datagrunnlag; manglende perioder skal være ukjent, ikke null trafikk.

## 2. Innholdskobling og analyse
- Normaliser http/www, avsluttende skråstrek og kjente `/cluster/...`-adresser uten å slå sammen ulike sider.
- Koble URL til eksisterende artikler, temaer, entiteter, vertikaler, guider, kunnskapssider, sammenligninger og søkeintensjoner. Artiklers klynger kommer utelukkende fra `article_clusters`.
- Beregn 3/7/28/90-dagers vinduer, vektet CTR/posisjon og sammenlignbare tidligere perioder. Marker manglende dekning og ikke-additive klyngetotaler ved flere medlemskap.
- Gi kun de seks tillatte anbefalingene med dokumentert bevis, periode og konfidens. CTR sammenlignes med egen historikk eller dokumentert sammenlignbart grunnlag, aldri en oppdiktet universell benchmark.
- Sjekk eksisterende dekning før CONTENT_GAP_REVIEW. Gjenbruk duplikatbeskyttelsen uten å bestille nye embeddings/LLM-kall; utilgjengelig semantisk bevis skal blokkere en sikker konklusjon om nytt gap.
- Analyser de oppgitte fintech-, AI- og kryptopilarene uten å lage sider. Uten tilstrekkelig Google-bevis brukes INSUFFICIENT_DATA der sterkere konklusjoner ikke kan forsvares.
- Legg en avgrenset, administratortilgjengelig målevisning i eksisterende kontrollpanel; ingen omdesign av offentlig nettsted.

## 3. Nyhetsnettkart — eget leveransepunkt
Nåværende React/Vite-publisering serverer statiske filer. Dokumentasjonen bekrefter ikke støtte for å koble en bakgrunnsfunksjon direkte til `/sitemap-news.xml`, endre publiserte filer fra en planlagt jobb eller bruke en automatisk publiserings-API. Ingen slik løsning skal oppdiktes.

- Behold øvrige Phase 7B-nettkart og canonical domene.
- Lag en testet nyhetsgenerator med publiseringsdatoer, 48-timers vindu, ingen fremtidige datoer/utkast/duplikater, og sharding ved mer enn 1 000 nyheter. Håndter tomt vindu uten gammel fil.
- **Avklar leveranse før mekanismen erstattes:** Hvis en støttet same-origin-løsning kan bekreftes, bruk den med 5–15 minutters cache. Ellers kreves et separat godkjent valg: en begrenset Cloudflare-løsning eller overgang til hosting med serverruter. Ingen navneserver-, proxy-, hosting- eller rammeverksendring utføres automatisk.
- En bakgrunnsgenerator alene er ikke en freshness-fiks. Denne delen forblir YELLOW/RED og endelig beslutning PHASE_7C_NOT_READY til den faktiske canonical URL-en er verifisert fersk mellom publiseringer.

## 4. Strukturert data og internlenker
- Fjern SearchAction i begge eksisterende definisjoner dersom `/sok` ikke fungerer. Fjern kun TopicPage sin ugyldige FAQPage; behold legitim, synlig FAQ andre steder.
- Utvid eksisterende internlenkefunksjon med stabile, begrensede sider og gjenopptakbar fremdrift for første fullstendige gjennomgang.
- Bruk deretter endringsbasert oppdatering og begrenset avstemming av relasjonsendringer. Oppdater/prun bare relevante lenker; rapporter feil i stedet for å ignorere dem.
- Mål publiserte/berørte artikler, lenker, selvlenker, duplikater, ugyldige/upubliserte mål og foreldreløse artikler før og etter.

## Tekniske og sikkerhetsmessige rammer
- Bruk Lovable Cloud-funksjoner, eksisterende admin-kontroll og `cron_invoke` for den ene daglige GSC-jobben. Valider verifisert eiendom hos Google ved hver synkronisering; ikke hardkod eiendommen i generert kode.
- Råmålinger og synkroniseringsstatus har eksplisitte grants og admin-RLS. Hemmeligheter leses kun på serversiden.
- Håndter paginering, ufullstendige dager og begrensninger; stopp ved 403 og respekter Retry-After ved 429. Ingen sidevisning henter live fra Google.
- Ingen endring i eksisterende nyhets-/klyngejobber eller klyngeregler, ingen AI-generering, ingen tittelforandringer og ingen massepublisering.

## Validering og avslutning
- Test konkrete regler: URL-normalisering, 48 timer og 1 000-grense, idempotent innhenting, periode-/vektingslogikk, OBSERVATION_ONLY, dekning før gap og full-korpus lenkebehandling.
- Verifiser autentisert administratortilgang, anonym tilgangsavslag, Google-kall og lagrede resultater, samt offentlig markup og nettkart. Ikke erklær syntetiske tester som bevis på produksjonsflyt.
- Oppdater AGENTS.md og veikart. Lever sluttrapport i nøyaktig strukturen fra spesifikasjonen med GREEN/YELLOW/RED og én endelig beslutning. Stopp der; ingen Phase 7D.