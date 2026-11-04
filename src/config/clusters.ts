export interface ClusterConfig {
  slug: string;
  name: string;
  vertical?: string; // route path like /ai, /krypto
  topicSlugs?: string[]; // seed topics (optional)
  intro: string;
  faq: { q: string; a: string }[];
  related: string[]; // related cluster slugs
}

export const CLUSTERS: ClusterConfig[] = [
  {
    slug: "ai",
    vertical: "/ai",
    name: "Kunstig intelligens",
    intro:
      "Marketrends sin redaksjonelle hub for kunstig intelligens. Vi dekker norske og internasjonale AI-aktører, regulering, modellutvikling og økonomiske ringvirkninger.",
    faq: [
      { q: "Hva er forskjellen på generativ AI og tradisjonell maskinlæring?", a: "Generativ AI lager nytt innhold (tekst, bilder, kode), mens tradisjonell maskinlæring klassifiserer og predikerer fra eksisterende data." },
      { q: "Hvordan reguleres AI i Norge?", a: "Norge følger EUs AI Act gjennom EØS-avtalen, med Datatilsynet og Forbrukertilsynet som sentrale tilsynsorganer." },
    ],
    related: ["fintech", "startup"],
  },
  {
    slug: "krypto",
    vertical: "/krypto",
    name: "Kryptovaluta",
    intro:
      "Krypto-hub for nordiske investorer. Analyse av Bitcoin, Ethereum, regulering (MiCA), norske aktører og makroøkonomisk kontekst.",
    faq: [
      { q: "Er kryptovaluta lovlig i Norge?", a: "Ja. Krypto er lovlig, men handel og oppbevaring er skattepliktig og rapporteringskrav gjelder via Skatteetaten." },
      { q: "Hva er MiCA?", a: "Markets in Crypto-Assets — EUs regelverk som regulerer kryptoaktører i hele EØS, inkludert Norge." },
    ],
    related: ["fintech", "investering"],
  },
  {
    slug: "fintech",
    vertical: "/fintech",
    name: "Fintech",
    intro:
      "Norsk og nordisk fintech: betalingsløsninger, neobanker, open banking, BankID og digital infrastruktur.",
    faq: [
      { q: "Hva er open banking?", a: "Et regelverk (PSD2) som gir tredjeparter regulert tilgang til kundens bankdata med samtykke." },
    ],
    related: ["krypto", "startup", "ai"],
  },
  {
    slug: "startup",
    vertical: "/startup",
    name: "Startup",
    intro:
      "Norsk startup-økosystem: kapitalrunder, exits, founders, akseleratorprogrammer og venture capital.",
    faq: [
      { q: "Hva er en pre-seed runde?", a: "Tidligste finansieringsfase, ofte fra angels eller mikro-VC for å validere produktidé og team." },
    ],
    related: ["fintech", "ai"],
  },
  {
    slug: "investering",
    vertical: "/investering",
    name: "Investering",
    intro:
      "Langsiktig investering og formuesbygging for norske sparere: aksjer, fond, ASK, IPS og porteføljekonstruksjon.",
    faq: [
      { q: "Hva er aksjesparekonto (ASK)?", a: "En konto hvor gevinst ved salg av aksjer og aksjefond utsettes til uttak fra kontoen, noe som gir skattefordel ved reinvestering." },
    ],
    related: ["daytrading", "krypto", "fintech"],
  },
  {
    slug: "daytrading",
    vertical: "/daytrading",
    name: "Daytrading",
    intro:
      "Kortsiktig handel, teknisk analyse, risikostyring og plattformsammenligninger for norske tradere.",
    faq: [
      { q: "Er daytrading lovlig i Norge?", a: "Ja, men gevinst beskattes som kapitalinntekt og krever nøyaktig dokumentasjon." },
    ],
    related: ["investering", "krypto"],
  },
];

export const getCluster = (slug: string) => CLUSTERS.find((c) => c.slug === slug);
export const getClusterByVertical = (path: string) => CLUSTERS.find((c) => c.vertical === path);
