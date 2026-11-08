import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, ChevronRight, Layers } from "lucide-react";

type Sibling = {
  id: string; target_slug: string | null; keyword: string; template: string;
  is_pillar: boolean; priority_score: number; quality_score?: number | null;
};

type Related = {
  knowledge: { slug: string; title: string }[];
  guides: { slug: string; title: string }[];
  comparisons: { slug: string; title: string }[];
  entities: { slug: string; name: string }[];
  articles: { slug: string; title: string }[];
};

const EMPTY: Related = { knowledge: [], guides: [], comparisons: [], entities: [], articles: [] };

interface Props {
  intent: any;
}

/**
 * Full pillar/cluster navigation for search-intent pages.
 * - Supporting pages: breadcrumb → pillar, back-to-pillar, prev/next, sibling list.
 * - Pillar pages: complete content hierarchy of the cluster.
 */
export const PillarNav = ({ intent }: Props) => {
  const [pillar, setPillar] = useState<Sibling | null>(null);
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const [related, setRelated] = useState<Related>(EMPTY);

  useEffect(() => {
    if (!intent) return;
    let cancelled = false;

    (async () => {
      const cluster = intent.search_cluster;

      // Pillar of this cluster (either the linked one, or the cluster's pillar row)
      let pillarRow: Sibling | null = null;
      if (intent.is_pillar) {
        pillarRow = intent as Sibling;
      } else if (intent.pillar_intent_id) {
        const { data } = await supabase.from("search_intents")
          .select("id,target_slug,keyword,template,is_pillar,priority_score,quality_score")
          .eq("id", intent.pillar_intent_id).maybeSingle();
        pillarRow = (data as Sibling) || null;
      }
      if (!pillarRow && cluster) {
        const { data } = await supabase.from("search_intents")
          .select("id,target_slug,keyword,template,is_pillar,priority_score,quality_score")
          .eq("search_cluster", cluster).eq("is_pillar", true)
          .eq("content_status", "published").maybeSingle();
        pillarRow = (data as Sibling) || null;
      }

      // All published supporting pages of the cluster, deterministic order
      let sibs: Sibling[] = [];
      if (cluster) {
        const { data } = await supabase.from("search_intents")
          .select("id,target_slug,keyword,template,is_pillar,priority_score,quality_score")
          .eq("search_cluster", cluster)
          .eq("content_status", "published")
          .eq("is_pillar", false)
          .order("priority_score", { ascending: false })
          .limit(40);
        sibs = (data as Sibling[]) || [];
      }

      // Related surfaces
      const rel: Related = { ...EMPTY };
      const [k, g, c, ent, art] = await Promise.all([
        supabase.from("knowledge_pages").select("slug,title").eq("published", true)
          .ilike("category", `%${cluster || ""}%`).limit(4),
        supabase.from("guides").select("slug,title").eq("published", true)
          .ilike("category", `%${cluster || ""}%`).limit(4),
        supabase.from("comparison_pages").select("slug,title").eq("published", true).limit(4),
        intent.entity_id
          ? supabase.from("entities").select("slug,name")
              .in("id", [intent.entity_id, intent.secondary_entity_id].filter(Boolean))
          : Promise.resolve({ data: [] as any[] }),
        // Canonical cluster membership only; articles.category never assigns a cluster.
        cluster
          ? supabase.from("article_clusters").select("articles!inner(slug,title,published,created_at)")
              .eq("cluster_slug", cluster).eq("articles.published", true)
              .order("created_at", { ascending: false }).limit(5)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      rel.knowledge = (k.data as any) || [];
      rel.guides = (g.data as any) || [];
      rel.comparisons = (c.data as any) || [];
      rel.entities = (ent.data as any) || [];
      rel.articles = ((art.data as any[]) || []).map((r) => r.articles ?? r);

      if (cancelled) return;
      setPillar(pillarRow);
      setSiblings(sibs);
      setRelated(rel);
    })();

    return () => { cancelled = true; };
  }, [intent?.id]);

  const idx = siblings.findIndex((s) => s.id === intent?.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const hasRelated =
    related.knowledge.length || related.guides.length || related.comparisons.length ||
    related.entities.length || related.articles.length;

  return (
    <div className="mt-12 space-y-10">
      {/* Back to pillar */}
      {!intent.is_pillar && pillar?.target_slug && (
        <nav aria-label="Tilbake til pilarside">
          <Link
            to={`/intent/${pillar.target_slug}`}
            className="inline-flex items-center gap-2 border border-border hover:border-foreground px-4 py-3 min-h-11 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Tilbake til pilar
              </span>
              <span className="font-medium">{pillar.keyword}</span>
            </span>
          </Link>
        </nav>
      )}

      {/* Prev / next supporting page */}
      {(prev || next) && (
        <nav aria-label="Naviger i klyngen" className="grid sm:grid-cols-2 gap-3">
          {prev?.target_slug ? (
            <Link to={`/intent/${prev.target_slug}`} className="border border-border hover:border-foreground p-4 transition-colors">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                <ArrowLeft className="h-3 w-3" />Forrige
              </span>
              <span className="font-medium leading-snug block">{prev.keyword}</span>
            </Link>
          ) : <span className="hidden sm:block" />}
          {next?.target_slug && (
            <Link to={`/intent/${next.target_slug}`} className="border border-border hover:border-foreground p-4 transition-colors sm:text-right">
              <span className="flex items-center gap-1 sm:justify-end text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Neste<ArrowRight className="h-3 w-3" />
              </span>
              <span className="font-medium leading-snug block">{next.keyword}</span>
            </Link>
          )}
        </nav>
      )}

      {/* Cluster overview / complete hierarchy */}
      {(siblings.length > 0 || pillar) && (
        <section className="border-t-2 border-foreground pt-8">
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {intent.is_pillar ? "Innholdshierarki" : "Klyngeoversikt"}
          </h2>
          {intent.search_cluster && (
            <p className="text-sm text-muted-foreground mb-5">
              Klynge: <span className="font-medium text-foreground">{intent.search_cluster}</span> ·{" "}
              {siblings.length} støtteside{siblings.length === 1 ? "" : "r"}
            </p>
          )}

          {pillar?.target_slug && (
            <Link
              to={`/intent/${pillar.target_slug}`}
              className={`block border-2 p-4 mb-4 transition-colors ${
                intent.is_pillar ? "border-foreground bg-muted/40" : "border-border hover:border-foreground"
              }`}
              aria-current={intent.is_pillar ? "page" : undefined}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-destructive block mb-1">Pilarside</span>
              <span className="font-semibold leading-snug">{pillar.keyword}</span>
            </Link>
          )}

          <ul className="space-y-2">
            {siblings.map((s) => {
              const active = s.id === intent.id;
              return (
                <li key={s.id} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-3 shrink-0 text-muted-foreground" aria-hidden />
                  {s.target_slug ? (
                    <Link
                      to={`/intent/${s.target_slug}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex-1 border p-3 transition-colors ${
                        active ? "border-foreground bg-muted/40 font-semibold" : "border-border hover:border-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-0.5">
                        {s.template}
                      </span>
                      <span className="leading-snug">{s.keyword}</span>
                    </Link>
                  ) : (
                    <span className="flex-1 border border-dashed border-border p-3 text-muted-foreground">{s.keyword}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Related surfaces */}
      {!!hasRelated && (
        <section className="border-t border-border pt-8">
          <h2 className="text-xl font-bold mb-5">Relatert innhold</h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
            <RelatedList title="Kunnskapssider" base="/knowledge" items={related.knowledge.map((r) => ({ slug: r.slug, label: r.title }))} />
            <RelatedList title="Guider" base="/guide" items={related.guides.map((r) => ({ slug: r.slug, label: r.title }))} />
            <RelatedList title="Sammenligninger" base="/compare" items={related.comparisons.map((r) => ({ slug: r.slug, label: r.title }))} />
            <RelatedList title="Entiteter" base="/entity" items={related.entities.map((r) => ({ slug: r.slug, label: r.name }))} />
            <RelatedList title="Nyheter" base="" items={related.articles.map((r) => ({ slug: r.slug, label: r.title }))} />
          </div>
        </section>
      )}
    </div>
  );
};

const RelatedList = ({ title, base, items }: { title: string; base: string; items: { slug: string; label: string }[] }) => {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.slug}>
            <Link to={`${base}/${i.slug}`} className="text-sm hover:underline underline-offset-2 leading-snug">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PillarNav;
