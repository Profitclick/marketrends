import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { BarChart3, TrendingUp, Rss } from "lucide-react";

interface DailyCount {
  date: string;
  published: number;
  draft: number;
}

interface QualityDataPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface FeedHealth {
  name: string;
  articles: number;
  active: boolean;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(280 67% 55%)",
  "hsl(0 84% 60%)",
];

export const PublishingStats = () => {
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [qualityData, setQualityData] = useState<QualityDataPoint[]>([]);
  const [feedHealth, setFeedHealth] = useState<FeedHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    setLoading(true);
    await Promise.all([fetchDailyCounts(), fetchQualityData(), fetchFeedHealth()]);
    setLoading(false);
  };

  const fetchDailyCounts = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("articles")
      .select("created_at, published")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: true });

    if (!data) return;

    const grouped: Record<string, { published: number; draft: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = format(subDays(new Date(), 29 - i), "yyyy-MM-dd");
      grouped[d] = { published: 0, draft: 0 };
    }

    data.forEach((a) => {
      const day = format(new Date(a.created_at), "yyyy-MM-dd");
      if (grouped[day]) {
        if (a.published) grouped[day].published++;
        else grouped[day].draft++;
      }
    });

    setDailyCounts(
      Object.entries(grouped).map(([date, counts]) => ({
        date: format(new Date(date), "d. MMM", { locale: nb }),
        ...counts,
      }))
    );
  };

  const fetchQualityData = async () => {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("articles")
      .select("created_at, ai_quality_score")
      .gte("created_at", thirtyDaysAgo)
      .not("ai_quality_score", "is", null)
      .order("created_at", { ascending: true });

    if (!data) return;

    const grouped: Record<string, { total: number; count: number }> = {};
    data.forEach((a) => {
      const day = format(new Date(a.created_at), "yyyy-MM-dd");
      if (!grouped[day]) grouped[day] = { total: 0, count: 0 };
      grouped[day].total += Number(a.ai_quality_score);
      grouped[day].count++;
    });

    setQualityData(
      Object.entries(grouped).map(([date, { total, count }]) => ({
        date: format(new Date(date), "d. MMM", { locale: nb }),
        avgScore: Math.round((total / count) * 100) / 100,
        count,
      }))
    );
  };

  const fetchFeedHealth = async () => {
    const { data: feeds } = await supabase.from("rss_feeds").select("id, name, active");
    if (!feeds) return;

    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const { data: articles } = await supabase
      .from("articles")
      .select("source_name, id")
      .gte("created_at", sevenDaysAgo);

    const countBySource: Record<string, number> = {};
    articles?.forEach((a) => {
      countBySource[a.source_name] = (countBySource[a.source_name] || 0) + 1;
    });

    setFeedHealth(
      feeds
        .map((f) => ({
          name: f.name,
          articles: countBySource[f.name] || 0,
          active: f.active ?? false,
        }))
        .sort((a, b) => b.articles - a.articles)
    );
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-[250px] w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const articlesChartConfig = {
    published: { label: "Publisert", color: "hsl(142 76% 36%)" },
    draft: { label: "Utkast", color: "hsl(38 92% 50%)" },
  };

  const qualityChartConfig = {
    avgScore: { label: "Gj.snitt score", color: "hsl(var(--primary))" },
  };

  const activeFeedCount = feedHealth.filter((f) => f.active).length;
  const producingFeeds = feedHealth.filter((f) => f.articles > 0).length;

  return (
    <div className="space-y-6">
      {/* Articles per day */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Artikler per dag (siste 30 dager)
          </CardTitle>
          <CardDescription>Publiserte vs. utkast over tid</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={articlesChartConfig} className="h-[300px] w-full">
            <BarChart data={dailyCounts} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="published" stackId="a" fill="var(--color-published)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="draft" stackId="a" fill="var(--color-draft)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* AI Quality over time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI-kvalitetsscore over tid
            </CardTitle>
            <CardDescription>Gjennomsnittlig score per dag</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={qualityChartConfig} className="h-[250px] w-full">
              <LineChart data={qualityData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(qualityData.length / 6))} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="var(--color-avgScore)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Feed health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5" />
              Feed-helse (siste 7 dager)
            </CardTitle>
            <CardDescription>
              {producingFeeds} av {activeFeedCount} aktive feeds produserer innhold
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {feedHealth.map((feed, i) => (
                <div key={feed.name} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: feed.active ? (feed.articles > 0 ? "hsl(142 76% 36%)" : "hsl(38 92% 50%)") : "hsl(var(--muted-foreground))" }}
                    />
                    <span className="text-sm truncate">{feed.name}</span>
                  </div>
                  <span className="text-sm font-mono font-medium tabular-nums shrink-0">
                    {feed.articles} art.
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
