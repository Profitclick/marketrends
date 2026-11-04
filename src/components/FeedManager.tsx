import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Feed {
  id: string;
  name: string;
  url: string;
  active: boolean;
  last_fetched: string | null;
  created_at: string;
}

interface FeedManagerProps {
  onUpdate: () => void;
}

export const FeedManager = ({ onUpdate }: FeedManagerProps) => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeeds = async () => {
    try {
      const { data, error } = await supabase
        .from("rss_feeds")
        .select("*")
        .order("name");

      if (error) throw error;
      setFeeds(data || []);
    } catch (error) {
      console.error("Error fetching feeds:", error);
      toast.error("Failed to fetch feeds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeds();
  }, []);

  const toggleFeed = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("rss_feeds")
        .update({ active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentStatus ? "Feed deactivated" : "Feed activated");
      fetchFeeds();
      onUpdate();
    } catch (error) {
      console.error("Error updating feed:", error);
      toast.error("Failed to update feed");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading feeds...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>RSS Feed Sources</CardTitle>
          <CardDescription>
            Manage the sources for automated article fetching and processing
          </CardDescription>
        </CardHeader>
      </Card>

      {feeds.map((feed) => (
        <Card key={feed.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-lg">{feed.name}</CardTitle>
                  <Badge variant={feed.active ? "default" : "secondary"}>
                    {feed.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="break-all">{feed.url}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(feed.url, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </CardDescription>
                <div className="mt-3 text-sm text-muted-foreground">
                  {feed.last_fetched ? (
                    <span>Last fetched: {format(new Date(feed.last_fetched), "PPpp")}</span>
                  ) : (
                    <span>Never fetched</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={feed.active}
                  onCheckedChange={() => toggleFeed(feed.id, feed.active)}
                />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};
