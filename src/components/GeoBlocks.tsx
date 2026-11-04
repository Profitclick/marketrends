import { Sparkles, ListChecks, HelpCircle, Quote, LinkIcon, Compass } from "lucide-react";

interface Source { title?: string; url: string; publisher?: string }
interface FAQ { q: string; a: string }

export interface GeoBlocksData {
  tldr?: string;
  quick_answer?: string;
  key_facts?: string[];
  why_it_matters?: string;
  expert_summary?: string;
  faq?: FAQ[];
  related_questions?: string[];
  sources?: Source[];
}

export const GeoBlocks = ({ data }: { data: GeoBlocksData }) => {
  if (!data) return null;
  return (
    <div className="space-y-10 my-10">
      {data.tldr && (
        <section aria-label="TL;DR" className="tldr border-l-4 border-foreground bg-muted/30 px-5 py-3">
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">TL;DR</div>
          <p className="text-[15px] leading-relaxed">{data.tldr}</p>
        </section>
      )}

      {data.quick_answer && (
        <section aria-label="Quick Answer" className="quick-answer border-l-4 border-primary bg-muted/40 px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Quick answer
          </div>
          <p className="text-base leading-relaxed">{data.quick_answer}</p>
        </section>
      )}

      {data.key_facts?.length ? (
        <section aria-label="Key Facts">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-destructive mb-3">
            <ListChecks className="h-3.5 w-3.5" /> Key facts
          </div>
          <ul className="space-y-2">
            {data.key_facts.map((f, i) => (
              <li key={i} className="pl-4 relative text-[15px] leading-relaxed">
                <span className="absolute left-0 top-2.5 h-1.5 w-1.5 bg-destructive" />{f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.why_it_matters && (
        <section aria-label="Why It Matters" className="border-y border-border py-5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            <Compass className="h-3.5 w-3.5" /> Hvorfor det betyr noe
          </div>
          <p className="text-[15px] leading-relaxed">{data.why_it_matters}</p>
        </section>
      )}

      {data.expert_summary && (
        <section aria-label="Expert Summary">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            <Quote className="h-3.5 w-3.5" /> Ekspertoppsummering
          </div>
          <p className="text-[15px] leading-relaxed text-foreground/85">{data.expert_summary}</p>
        </section>
      )}

      {data.faq?.length ? (
        <section aria-label="FAQ">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <HelpCircle className="h-3.5 w-3.5" /> Ofte stilte spørsmål
          </div>
          <div className="space-y-5">
            {data.faq.map((f, i) => (
              <div key={i}>
                <h3 className="font-semibold mb-1">{f.q}</h3>
                <p className="text-foreground/80 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.related_questions?.length ? (
        <section aria-label="Related Questions">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <HelpCircle className="h-3.5 w-3.5" /> Relaterte spørsmål
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.related_questions.map((q, i) => (
              <li key={i} className="pl-4 relative">
                <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-muted-foreground/60" />{q}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.sources?.length ? (
        <section aria-label="Sources">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <LinkIcon className="h-3.5 w-3.5" /> Kilder
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener nofollow" className="underline underline-offset-4 hover:text-primary">
                  {s.title || s.url}
                </a>
                {s.publisher && <span className="text-muted-foreground"> — {s.publisher}</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default GeoBlocks;
