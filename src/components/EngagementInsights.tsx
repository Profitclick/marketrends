import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, Network } from "lucide-react";

interface Row {
  label: string;
  value: string | number;
  href?: string;
}

// Read-only engagement snapshot for the dashboard. Uses existing stats only.
export const EngagementInsights = () => {
  const [topTopics, setTopTopics] = useState<any[]>([]);
  const [topEntities, setTopEntities] = useState<any[]>([]);
  const [topArticles, setTopArticles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [t, e, rels] = await Promise.all([
        supabase
          .from("topics")
          .select("id, slug, name, article_count, trending_score, articles_last_7d")
          .gte("article_count", 1)
          .order("trending_score", { ascending: false })
          .limit(10),
        supabase
          .from("entities")
          .select("id, slug, name, type, mention_count, trending_score")
          .gt("mention_count", 0)
          .order("trending_score", { ascending: false })
          .limit(10),
        supabase
          .from("article_relations")
          .select("article_id, related_article_id")
          .gte("created_at", new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString())
          .limit(2000),
      ]);
      setTopTopics((t.data as any) || []);
      setTopEntities((e.data as any) || []);

      const counts = new Map<string, number>();
      ((rels.data as any) || []).forEach((r: any) => {
        counts.set(r.article_id, (counts.get(r.article_id) || 0) + 1);
      });
      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);
      if (topIds.length) {
        const { data: arts } = await supabase
          .from("articles")
          .select("id, slug, title, category")
          .in("id", topIds);
        const ordered = (arts || [])
          .map((a: any) => ({ ...a, rel_count: counts.get(a.id) || 0 }))
          .sort((a: any, b: any) => b.rel_count - a.rel_count);
        setTopArticles(ordered);
      }
    })();
  }, []);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Mest sentrale artikler
          </CardTitle>
          <CardDescription>Flest semantiske relasjoner siste 21 dager</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {topArticles.length === 0 && <li className="text-muted-foreground">Ingen data ennå.</li>}
            {topArticles.map((a, i) => (
              <li key={a.id} className="flex gap-2">
                <span className="text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                <a href={`/${a.slug}`} className="flex-1 hover:underline line-clamp-2">
                  {a.title}
                </a>
                <span className="text-muted-foreground tabular-nums">{a.rel_count}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4" />
            Trending temaer
          </CardTitle>
          <CardDescription>Sortert på trending_score</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {topTopics.length === 0 && <li className="text-muted-foreground">Ingen data ennå.</li>}
            {topTopics.map((t, i) => (
              <li key={t.id} className="flex gap-2">
                <span className="text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                <a href={`/topic/${t.slug}`} className="flex-1 hover:underline line-clamp-1">
                  {t.name}
                </a>
                <span className="text-muted-foreground tabular-nums">{t.articles_last_7d ?? 0}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Trending aktører
          </CardTitle>
          <CardDescription>Sortert på trending_score</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {topEntities.length === 0 && <li className="text-muted-foreground">Ingen data ennå.</li>}
            {topEntities.map((e, i) => (
              <li key={e.id} className="flex gap-2">
                <span className="text-muted-foreground tabular-nums w-5">{i + 1}.</span>
                <a href={`/entity/${e.slug}`} className="flex-1 hover:underline line-clamp-1">
                  {e.name}
                </a>
                <span className="text-muted-foreground tabular-nums">{e.mention_count}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};
