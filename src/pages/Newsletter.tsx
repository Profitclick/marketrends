import { useState } from "react";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { NewsFooter } from "@/components/NewsFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail } from "lucide-react";

const CATEGORIES = [
  { key: "ai", title: "AI Brief", desc: "Ukentlig brief om AI-utvikling, modeller og norsk regulering." },
  { key: "krypto", title: "Krypto Brief", desc: "Bitcoin, Ethereum, MiCA og norske aktører." },
  { key: "fintech", title: "Fintech Brief", desc: "Norske banker, betalingsløsninger og open banking." },
  { key: "startup", title: "Startup Brief", desc: "Norske emisjoner, founders og venture capital." },
  { key: "investering", title: "Investering Brief", desc: "Aksjer, fond og porteføljestrategi for sparere." },
  { key: "daytrading", title: "Trading Brief", desc: "Teknisk analyse, risikostyring og plattformer." },
  { key: "general", title: "Ukens oppsummering", desc: "Det viktigste fra hele Marketrends, en gang i uken." },
];

const SubscribeForm = ({ category }: { category: string }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Ugyldig e-post");
    setLoading(true);
    const { error } = await (supabase as any).from("newsletter_subscriptions").insert({
      email: email.trim().toLowerCase(), category, source: "newsletter_center",
    });
    setLoading(false);
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("Påmeldt – takk!");
    setEmail("");
  };

  return (
    <form onSubmit={submit} className="flex gap-2 mt-3">
      <Input type="email" placeholder="din@epost.no" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Button type="submit" disabled={loading}>Meld på</Button>
    </form>
  );
};

const Newsletter = () => (
  <>
    <Helmet>
      <title>Newsletter Center – temabaserte nyhetsbrev | Marketrends</title>
      <meta name="description" content="Meld deg på Marketrends sine temabaserte nyhetsbrev innen AI, krypto, fintech, startup, investering og trading." />
      <link rel="canonical" href="https://marketrends.no/newsletter" />
    </Helmet>
    <Navigation />
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="border-b border-border pb-6 mb-10 flex items-start gap-4">
        <Mail className="h-8 w-8 mt-2" />
        <div>
          <h1 className="font-serif text-4xl md:text-5xl mb-3">Nyhetsbrev</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Temabaserte nyhetsbrev fra Marketrends. Velg de du vil følge — meld deg av når som helst.
          </p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {CATEGORIES.map((c) => (
          <section key={c.key} className="border border-border p-5">
            <h2 className="font-serif text-2xl mb-1">{c.title}</h2>
            <p className="text-sm text-muted-foreground">{c.desc}</p>
            <SubscribeForm category={c.key} />
          </section>
        ))}
      </div>
    </main>
    <NewsFooter />
  </>
);

export default Newsletter;
