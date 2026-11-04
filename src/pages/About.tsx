import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { SEOHead } from "@/components/SEOHead";
import { MarketTicker } from "@/components/MarketTicker";
import { LatestNewsTicker } from "@/components/LatestNewsTicker";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { authors } from "@/utils/authors";

const SITE_URL = "https://marketrends.no";

const About = () => {
  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Om oss"
        description="Marketrends.no er Norges ledende kilde for finans, teknologi, krypto og markedsnyheter. Møt redaksjonen bak nyhetene."
        canonicalUrl={`${SITE_URL}/om-oss`}
        ogType="website"
        breadcrumbs={[
          { name: "Hjem", url: SITE_URL },
          { name: "Om oss", url: `${SITE_URL}/om-oss` }
        ]}
      />

      <MarketTicker />
      <Navigation />

      <main className="max-w-[1200px] mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Om Marketrends.no</h1>

          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
            Marketrends.no er Norges ledende kilde for finans- og teknologinyheter.
            Vi kombinerer erfarne bransjeeksperter med avansert AI-teknologi for å levere
            skarpe analyser og relevante nyheter innen fintech, krypto, AI og startup-økosystemet.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-5 pb-2 border-b border-border">Vår misjon</h2>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Vi tror på at kvalitetsjournalistikk må være tilgjengelig, aktuell og relevant.
            Gjennom å kombinere menneskelig ekspertise med AI-drevet innholdskuratering,
            sikrer vi at våre lesere alltid er oppdatert på de viktigste utviklingene i
            teknologi- og finansbransjen.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-8 pb-2 border-b border-border">Redaksjonen</h2>

          <div className="space-y-6 mb-12">
            {authors.map((author) => (
              <div key={author.id} className="flex items-start gap-4 pb-6 border-b border-border last:border-b-0">
                <Avatar className="h-14 w-14 flex-shrink-0">
                  <AvatarImage src={author.image} alt={author.name} />
                  <AvatarFallback>{author.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{author.name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">{author.role}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{author.bio}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-border">
            <h2 className="text-2xl font-bold mb-4">Kontakt oss</h2>
            <div className="space-y-2 text-muted-foreground text-sm">
              <p><strong className="text-foreground">E-post:</strong> redaksjonen@marketrends.no</p>
              <p><strong className="text-foreground">Tips:</strong> tips@marketrends.no</p>
              <p><strong className="text-foreground">Annonsering:</strong> annonse@marketrends.no</p>
            </div>
          </div>
        </div>
      </main>

      <NewsFooter />
    </div>
  );
};

export default About;
