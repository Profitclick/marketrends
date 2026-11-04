import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Article {
  id: string;
  title: string;
  meta_description: string | null;
  category: string;
  tags: string[];
  published: boolean;
  created_at: string;
  source_name: string;
  source_url: string;
}

interface ArticleListProps {
  onUpdate: () => void;
}

export const ArticleList = ({ onUpdate }: ArticleListProps) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArticles = async () => {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error("Error fetching articles:", error);
      toast.error("Failed to fetch articles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("articles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Article deleted");
      fetchArticles();
      onUpdate();
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Failed to delete article");
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("articles")
        .update({ published: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentStatus ? "Article unpublished" : "Article published");
      fetchArticles();
      onUpdate();
    } catch (error) {
      console.error("Error updating article:", error);
      toast.error("Failed to update article");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading articles...</div>;
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Articles Yet</CardTitle>
          <CardDescription>
            Start by refreshing the RSS feeds to fetch and process new articles.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <Card key={article.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={article.published ? "default" : "secondary"}>
                    {article.published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline">{article.category}</Badge>
                </div>
                <CardTitle className="text-xl mb-2">{article.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {article.meta_description}
                </CardDescription>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{format(new Date(article.created_at), "PPP")}</span>
                  <span>•</span>
                  <span>{article.source_name}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => togglePublish(article.id, article.published)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(article.source_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(article.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          {article.tags && article.tags.length > 0 && (
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};
