import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Timer, Play } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface CronJobRun {
  id: string;
  created_at: string;
  log_type: string;
  log_level: string;
  message: string;
  context: {
    articles_published?: number;
    articles_checked?: number;
    articles_auto_published?: number;
    articles_queued_for_moderation?: number;
    duration_ms?: number;
    source?: string;
  } | null;
}

export const CronJobMonitor = () => {
  const [cronRuns, setCronRuns] = useState<CronJobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextRunTime, setNextRunTime] = useState<Date | null>(null);

  useEffect(() => {
    fetchCronRuns();
    
    // Calculate next run time (every 30 minutes)
    const now = new Date();
    const minutes = now.getMinutes();
    const nextRun = new Date(now);
    if (minutes < 30) {
      nextRun.setMinutes(30, 0, 0);
    } else {
      nextRun.setHours(now.getHours() + 1, 0, 0, 0);
    }
    setNextRunTime(nextRun);

    // Update next run time every minute
    const interval = setInterval(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      const next = new Date(now);
      if (minutes < 30) {
        next.setMinutes(30, 0, 0);
      } else {
        next.setHours(now.getHours() + 1, 0, 0, 0);
      }
      setNextRunTime(next);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchCronRuns = async () => {
    try {
      const { data, error } = await supabase
        .from("system_logs")
        .select("*")
        .or("log_type.eq.feed_processing,log_type.eq.cron_execution")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Cast the data to our interface
      const runs = (data || []).map(log => ({
        ...log,
        context: log.context as CronJobRun['context']
      }));
      
      setCronRuns(runs);
    } catch (error) {
      console.error("Error fetching cron runs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get stats from recent runs
  const recentRuns = cronRuns.slice(0, 10);
  const successfulRuns = recentRuns.filter(r => r.log_level === 'info' || r.log_level === 'success');
  const failedRuns = recentRuns.filter(r => r.log_level === 'error' || r.log_level === 'critical');
  const totalArticlesPublished = recentRuns.reduce((sum, r) => 
    sum + (r.context?.articles_published || r.context?.articles_auto_published || 0), 0
  );
  
  const lastRun = cronRuns[0];
  const lastRunStatus = lastRun?.log_level === 'error' || lastRun?.log_level === 'critical' 
    ? 'error' 
    : 'success';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Automatisk Publisering
        </CardTitle>
        <CardDescription>
          Cron job kjører hvert 30. minutt for kontinuerlig innholdsproduksjon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-green-600">{successfulRuns.length}</div>
            <div className="text-xs text-muted-foreground">Vellykkede</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-destructive">{failedRuns.length}</div>
            <div className="text-xs text-muted-foreground">Feilet</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-primary">{totalArticlesPublished}</div>
            <div className="text-xs text-muted-foreground">Artikler pub.</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <div className="text-sm font-semibold">
              {nextRunTime ? formatDistanceToNow(nextRunTime, { locale: nb, addSuffix: true }) : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Neste kjøring</div>
          </div>
        </div>

        {/* Current Status */}
        <div className="flex items-center gap-3 p-4 rounded-lg border">
          {lastRunStatus === 'success' ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )}
          <div className="flex-1">
            <div className="font-medium">
              {lastRunStatus === 'success' ? 'System kjører normalt' : 'Feil oppdaget'}
            </div>
            <div className="text-sm text-muted-foreground">
              Siste kjøring: {lastRun ? formatDistanceToNow(new Date(lastRun.created_at), { locale: nb, addSuffix: true }) : 'Ukjent'}
            </div>
          </div>
          <Badge variant={lastRunStatus === 'success' ? 'default' : 'destructive'}>
            {lastRunStatus === 'success' ? 'Aktiv' : 'Feil'}
          </Badge>
        </div>

        {/* Recent Runs */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Siste kjøringer
          </h4>
          
          {loading ? (
            <div className="text-sm text-muted-foreground">Laster...</div>
          ) : cronRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground">Ingen kjøringer registrert ennå</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {cronRuns.map((run) => (
                <div
                  key={run.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    run.log_level === 'error' || run.log_level === 'critical'
                      ? 'bg-destructive/10 border-destructive/20'
                      : run.log_level === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-muted/30'
                  }`}
                >
                  {run.log_level === 'error' || run.log_level === 'critical' ? (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  ) : (
                    <Play className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">
                        {format(new Date(run.created_at), "d. MMM HH:mm", { locale: nb })}
                      </span>
                      <Badge 
                        variant={run.log_level === 'error' ? 'destructive' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {run.log_type}
                      </Badge>
                    </div>
                    
                    <p className="text-sm mt-1 text-foreground/80">{run.message}</p>
                    
                    {run.context && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {run.context.articles_published !== undefined && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            {run.context.articles_published} publisert
                          </span>
                        )}
                        {run.context.articles_auto_published !== undefined && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {run.context.articles_auto_published} auto-publisert
                          </span>
                        )}
                        {run.context.articles_queued_for_moderation !== undefined && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            {run.context.articles_queued_for_moderation} til moderering
                          </span>
                        )}
                        {run.context.articles_checked !== undefined && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            {run.context.articles_checked} sjekket
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
