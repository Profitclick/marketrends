import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, RefreshCw, Settings, FileText, Database, Activity, AlertCircle, Timer, BarChart3, Sparkles, Network, BookOpen, GitCompare, Compass, TrendingUp, Target } from "lucide-react";
import { ArticleList } from "@/components/ArticleList";
import { FeedManager } from "@/components/FeedManager";
import { ArticleModeration } from "@/components/ArticleModeration";
import { CronJobMonitor } from "@/components/CronJobMonitor";
import { PublishingStats } from "@/components/PublishingStats";
import { EngagementInsights } from "@/components/EngagementInsights";
import { OpportunityCenter } from "@/components/OpportunityCenter";
import { TopicHeatmap } from "@/components/TopicHeatmap";
import { LinkGraphPanel } from "@/components/LinkGraphPanel";
import { QualityMonitorPanel } from "@/components/QualityMonitorPanel";
import { ArchiveRepairPanel } from "@/components/ArchiveRepairPanel";

import { SearchIntentPanel } from "@/components/SearchIntentPanel";
import { GSCMeasuredPanel } from "@/components/GSCMeasuredPanel";
import { toast } from "sonner";

const Dashboard = () => {
  const [articlesCount, setArticlesCount] = useState({ total: 0, published: 0, draft: 0 });
  const [feedsCount, setFeedsCount] = useState(0);
  const [dataSourcesCount, setDataSourcesCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingBackfill, setLoadingBackfill] = useState(false);
  const [loadingRebuild, setLoadingRebuild] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState(20);

  const fetchStats = async () => {
    try {
      const { count: totalCount } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true });

      const { count: publishedCount } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("published", true);

      const { count: feedCount } = await supabase
        .from("rss_feeds")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      const { count: dataSourceCount } = await supabase
        .from("data_sources")
        .select("*", { count: "exact", head: true })
        .eq("active", true);

      // Fetch recent logs
      const { data: logs } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      setArticlesCount({
        total: totalCount || 0,
        published: publishedCount || 0,
        draft: (totalCount || 0) - (publishedCount || 0),
      });
      setFeedsCount(feedCount || 0);
      setDataSourcesCount(dataSourceCount || 0);
      setRecentLogs(logs || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    toast.info("Starter RSS-innhenting og AI-prosessering...");
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-and-process-feeds');
      
      if (error) throw error;
      
      const result = data as { articles_published: number; articles_checked: number };
      toast.success(`Ferdig! ${result.articles_published} nye artikler publisert av ${result.articles_checked} sjekket.`);
      await fetchStats();
    } catch (error) {
      console.error("Error triggering feed refresh:", error);
      toast.error("Feil ved oppdatering av feeds");
    } finally {
      setLoading(false);
    }
  };

  const handleDataIngest = async () => {
    setLoadingData(true);
    toast.info("Starter innhenting av åpne data fra norske kilder...");
    
    try {
      const { data, error } = await supabase.functions.invoke('ingest-open-data');
      
      if (error) throw error;
      
      const result = data as { sources_processed: number };
      toast.success(`Ferdig! ${result.sources_processed} datakilder prosessert.`);
      await fetchStats();
    } catch (error) {
      console.error("Error triggering data ingest:", error);
      toast.error("Feil ved innhenting av åpne data");
    } finally {
      setLoadingData(false);
    }
  };

  const handleBackfill = async () => {
    setLoadingBackfill(true);
    toast.info(`Starter backfill av ${backfillLimit} artikler...`);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-enrichment', {
        body: { limit: backfillLimit, only_missing: true },
      });
      if (error) throw error;
      const r = data as { enriched: number; skipped: number; failed: number; total: number };
      toast.success(`Backfill ferdig: ${r.enriched} beriket, ${r.skipped} hoppet over, ${r.failed} feilet (${r.total} totalt).`);
    } catch (error_: unknown) { const error = error_ instanceof Error ? error_ : new Error(String(error_));
      console.error("Backfill error:", error);
      toast.error(`Feil under backfill: ${error.message || 'ukjent'}`);
    } finally {
      setLoadingBackfill(false);
    }
  };

  const handleRebuildTopics = async () => {
    setLoadingRebuild(true);
    toast.info("Rebuilder topic stats og relasjoner...");
    try {
      const { data, error } = await supabase.functions.invoke('rebuild-topic-stats');
      if (error) throw error;
      const r = data as { topics_updated: number; relations: number };
      toast.success(`Ferdig: ${r.topics_updated} temaer oppdatert, ${r.relations} relasjoner.`);
    } catch (error_: unknown) { const error = error_ instanceof Error ? error_ : new Error(String(error_));
      console.error("Rebuild error:", error);
      toast.error(`Feil ved rebuild: ${error.message || 'ukjent'}`);
    } finally {
      setLoadingRebuild(false);
    }
  };

  const [loadingEntities, setLoadingEntities] = useState(false);
  const handleRebuildEntities = async () => {
    setLoadingEntities(true);
    toast.info("Rebuilder entity-statistikk og relasjoner...");
    try {
      const { data, error } = await supabase.functions.invoke('rebuild-entity-stats');
      if (error) throw error;
      const r = data as { entities_updated: number; relations_upserted: number };
      toast.success(`Ferdig: ${r.entities_updated} aktører, ${r.relations_upserted} relasjoner.`);
    } catch (error_: unknown) { const error = error_ instanceof Error ? error_ : new Error(String(error_));
      toast.error(`Feil ved entity-rebuild: ${error.message || 'ukjent'}`);
    } finally {
      setLoadingEntities(false);
    }
  };

  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);

  const runGenerator = async (
    fn: string, label: string,
    setLoad: (v: boolean) => void, body: Record<string, unknown> = {},
  ) => {
    setLoad(true);
    toast.info(`Genererer ${label}…`);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      const r = data as { generated?: number; errors?: number; topicsUpdated?: number; entitiesUpdated?: number };
      if (r.generated !== undefined) {
        toast.success(`${label}: ${r.generated} generert, ${r.errors || 0} feil.`);
      } else {
        toast.success(`${label}: ${r.topicsUpdated || 0} temaer, ${r.entitiesUpdated || 0} aktører.`);
      }
    } catch (e_: unknown) { const e = e_ instanceof Error ? e_ : new Error(String(e_));
      toast.error(`Feil ved ${label}: ${e.message || "ukjent"}`);
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Newspaper className="h-8 w-8 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">Marketrends.no</h1>
              <p className="text-sm opacity-90">Redaksjonelt Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Action toolbar */}
      <div className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-auto">
              <label htmlFor="backfill-limit" className="text-xs font-medium text-muted-foreground">
                Backfill antall
              </label>
              <input
                id="backfill-limit"
                type="number"
                min={1}
                max={50}
                value={backfillLimit}
                onChange={(e) => setBackfillLimit(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Antall artikler å berike"
              />
            </div>
            <Button onClick={handleBackfill} disabled={loadingBackfill} variant="outline" size="sm" title="Beriker artikler med temaer/entiteter via AI.">
              <Sparkles className={`h-4 w-4 mr-2 ${loadingBackfill ? "animate-spin" : ""}`} aria-hidden="true" />
              Backfill
            </Button>
            <Button onClick={handleRebuildTopics} disabled={loadingRebuild} variant="outline" size="sm" title="Rekalkulerer trending-score og topic_relations.">
              <Network className={`h-4 w-4 mr-2 ${loadingRebuild ? "animate-spin" : ""}`} aria-hidden="true" />
              Topics
            </Button>
            <Button onClick={handleRebuildEntities} disabled={loadingEntities} variant="outline" size="sm" title="Rekalkulerer entity trending og co-occurrence.">
              <Activity className={`h-4 w-4 mr-2 ${loadingEntities ? "animate-spin" : ""}`} aria-hidden="true" />
              Entities
            </Button>
            <Button onClick={() => runGenerator("compute-trends", "trend-scores", setLoadingTrends)} disabled={loadingTrends} variant="outline" size="sm">
              <TrendingUp className={`h-4 w-4 mr-2 ${loadingTrends ? "animate-spin" : ""}`} aria-hidden="true" />
              Trends
            </Button>
            <Button onClick={() => runGenerator("generate-knowledge-pages", "kunnskapssider", setLoadingKnowledge, { limit: 3 })} disabled={loadingKnowledge} variant="outline" size="sm">
              <BookOpen className={`h-4 w-4 mr-2 ${loadingKnowledge ? "animate-spin" : ""}`} aria-hidden="true" />
              Knowledge
            </Button>
            <Button onClick={() => runGenerator("generate-comparisons", "sammenligninger", setLoadingCompare, { limit: 2 })} disabled={loadingCompare} variant="outline" size="sm">
              <GitCompare className={`h-4 w-4 mr-2 ${loadingCompare ? "animate-spin" : ""}`} aria-hidden="true" />
              Compare
            </Button>
            <Button onClick={() => runGenerator("generate-guides", "guider", setLoadingGuides, { limit: 2 })} disabled={loadingGuides} variant="outline" size="sm">
              <Compass className={`h-4 w-4 mr-2 ${loadingGuides ? "animate-spin" : ""}`} aria-hidden="true" />
              Guides
            </Button>
            <Button onClick={handleDataIngest} disabled={loadingData} variant="outline" size="sm">
              <Database className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} aria-hidden="true" />
              Åpne data
            </Button>
            <Button onClick={handleRefresh} disabled={loading} variant="default" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh feeds
            </Button>
          </div>
        </div>
      </div>


      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{articlesCount.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{articlesCount.published}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{articlesCount.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RSS Feeds</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{feedsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dataSourcesCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* System Logs */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Activity
            </CardTitle>
            <CardDescription>Recent system logs and processing events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              ) : (
                recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      log.log_level === 'error' || log.log_level === 'critical'
                        ? 'bg-destructive/10 border-destructive/20'
                        : log.log_level === 'warning'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-muted/50'

                    }`}
                  >
                    {(log.log_level === 'error' || log.log_level === 'critical') && (
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          {log.log_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('nb-NO')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cron Job Monitor */}
        <div className="mb-8">
          <CronJobMonitor />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="stats" className="space-y-4">
          <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex w-auto min-w-full md:w-full flex-nowrap md:flex-wrap justify-start h-auto">
              <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1.5" aria-hidden="true" />Statistikk</TabsTrigger>
              <TabsTrigger value="gsc"><BarChart3 className="h-4 w-4 mr-1.5" aria-hidden="true" />Google-målinger</TabsTrigger>
              <TabsTrigger value="opportunities"><Compass className="h-4 w-4 mr-1.5" aria-hidden="true" />Opportunities</TabsTrigger>
              <TabsTrigger value="engagement"><TrendingUp className="h-4 w-4 mr-1.5" aria-hidden="true" />Engagement</TabsTrigger>
              <TabsTrigger value="heatmap"><Network className="h-4 w-4 mr-1.5" aria-hidden="true" />Heatmap</TabsTrigger>
              <TabsTrigger value="linkgraph"><Network className="h-4 w-4 mr-1.5" aria-hidden="true" />Lenkegraf</TabsTrigger>
              <TabsTrigger value="quality"><Activity className="h-4 w-4 mr-1.5" aria-hidden="true" />Kvalitet</TabsTrigger>
              <TabsTrigger value="intents"><Target className="h-4 w-4 mr-1.5" aria-hidden="true" />Søkeintent</TabsTrigger>
              <TabsTrigger value="moderation">Moderering</TabsTrigger>
              <TabsTrigger value="articles">Artikler</TabsTrigger>
              <TabsTrigger value="feeds">RSS Feeds</TabsTrigger>
              <TabsTrigger value="automation">Automatisering</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stats" className="space-y-4">
            <PublishingStats />
          </TabsContent>
          <TabsContent value="gsc"><GSCMeasuredPanel /></TabsContent>
          <TabsContent value="opportunities" className="space-y-4">
            <OpportunityCenter />
          </TabsContent>
          <TabsContent value="heatmap" className="space-y-4">
            <TopicHeatmap />
          </TabsContent>
          <TabsContent value="linkgraph" className="space-y-4">
            <LinkGraphPanel />
          </TabsContent>
          <TabsContent value="engagement" className="space-y-4">
            <EngagementInsights />
          </TabsContent>
          <TabsContent value="quality" className="space-y-8">
            <ArchiveRepairPanel />
            <QualityMonitorPanel />
          </TabsContent>

          <TabsContent value="intents" className="space-y-4">
            <SearchIntentPanel />
          </TabsContent>
          <TabsContent value="moderation" className="space-y-4">
            <ArticleModeration onUpdate={fetchStats} />
          </TabsContent>
          <TabsContent value="articles" className="space-y-4">
            <ArticleList onUpdate={fetchStats} />
          </TabsContent>
          <TabsContent value="feeds" className="space-y-4">
            <FeedManager onUpdate={fetchStats} />
          </TabsContent>
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Automatisering Oversikt
                </CardTitle>
                <CardDescription>
                  Systemet kjører automatisk innhenting og prosessering av nyheter hvert 30. minutt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-semibold mb-2">Cron Job Schedule</h4>
                    <p className="text-sm text-muted-foreground">
                      <code className="bg-background px-2 py-1 rounded">*/30 * * * *</code>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Kjører ved :00 og :30 hver time
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-semibold mb-2">Auto-Publish Terskel</h4>
                    <p className="text-2xl font-bold text-primary">≥ 0.75</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      AI-kvalitetsscore for automatisk publisering
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-lg border bg-accent/5">
                  <h4 className="font-semibold mb-2">Prosessflyt</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Hent nyheter fra alle aktive RSS-feeds</li>
                    <li>Filtrer ut duplikater basert på URL</li>
                    <li>AI-oversettelse og bearbeidelse til norsk</li>
                    <li>AI-klassifisering (breaking, analysis, guide, feature, tabloid)</li>
                    <li>AI-kvalitetsscore (0.0 - 1.0)</li>
                    <li>Auto-publiser hvis score ≥ 0.75, ellers til moderasjonskø</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Complete System Logs</CardTitle>
                <CardDescription>All system activity, errors, and processing events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {recentLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No logs available</p>
                  ) : (
                    recentLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border ${
                          log.log_level === 'error' || log.log_level === 'critical'
                            ? 'bg-destructive/10 border-destructive/20'
                            : log.log_level === 'warning'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-muted/50'
                        }`}
                      >
                        {(log.log_level === 'error' || log.log_level === 'critical') && (
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                              log.log_level === 'error' || log.log_level === 'critical'
                                ? 'bg-destructive text-destructive-foreground'
                                : log.log_level === 'warning'
                                ? 'bg-amber-500 text-white'
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              {log.log_level}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {log.log_type}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(log.created_at).toLocaleString('nb-NO', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{log.message}</p>
                          {log.context && (
                            <pre className="text-xs bg-background/50 p-2 rounded mt-2 overflow-x-auto">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
