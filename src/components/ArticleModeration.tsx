import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { CheckCircle, XCircle, Edit, ExternalLink, Sparkles, AlertCircle, Clock, Zap, Eye } from "lucide-react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";

interface Article {
  id: string;
  title: string;
  slug: string;
  meta_description: string | null;
  content: string;
  category: string;
  tags: string[] | null;
  image_url: string | null;
  source_url: string;
  source_name: string;
  created_at: string;
  ai_quality_score: number | null;
  ai_status: string | null;
  article_type: string | null;
}

// Helper to get quality score color and label
const getQualityInfo = (score: number | null) => {
  if (score === null) return { color: "text-muted-foreground", bg: "bg-muted", label: "Ikke vurdert", icon: Clock };
  if (score >= 0.75) return { color: "text-emerald-600", bg: "bg-emerald-500", label: "Høy kvalitet", icon: Zap };
  if (score >= 0.5) return { color: "text-amber-600", bg: "bg-amber-500", label: "Medium kvalitet", icon: Sparkles };
  return { color: "text-red-600", bg: "bg-red-500", label: "Lav kvalitet", icon: AlertCircle };
};

// Helper to get AI status info
const getAiStatusInfo = (status: string | null) => {
  switch (status) {
    case "success":
      return { color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "AI OK" };
    case "pending":
      return { color: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Venter" };
    case "error":
      return { color: "bg-red-500/10 text-red-600 border-red-500/30", label: "Feil" };
    case "credit_missing":
      return { color: "bg-red-500/10 text-red-600 border-red-500/30", label: "Mangler credits" };
    default:
      return { color: "bg-muted text-muted-foreground border-muted", label: status || "Ukjent" };
  }
};

interface ArticleModerationProps {
  onUpdate: () => void;
}

export const ArticleModeration = ({ onUpdate }: ArticleModerationProps) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [manualScore, setManualScore] = useState<number>(0.75);

  const fetchDraftArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("published", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error("Error fetching draft articles:", error);
      toast.error("Feil ved henting av artikkelutkast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraftArticles();
  }, []);

  const toggleArticleSelection = (id: string) => {
    setSelectedArticles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map((a) => a.id)));
    }
  };

  // Select all high-quality articles
  const selectHighQuality = () => {
    const highQualityIds = articles
      .filter(a => (a.ai_quality_score ?? 0) >= 0.75 || (a.ai_status === 'success' && a.content.length > 800))
      .map(a => a.id);
    setSelectedArticles(new Set(highQualityIds));
  };

  const handleBulkApprove = async () => {
    if (selectedArticles.size === 0) {
      toast.error("Ingen artikler valgt");
      return;
    }

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from("articles")
        .update({ published: true })
        .in("id", Array.from(selectedArticles));

      if (error) throw error;

      toast.success(`${selectedArticles.size} artikler godkjent og publisert!`);
      setSelectedArticles(new Set());
      fetchDraftArticles();
      onUpdate();
    } catch (error) {
      console.error("Error bulk approving articles:", error);
      toast.error("Feil ved bulk-godkjenning");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedArticles.size === 0) {
      toast.error("Ingen artikler valgt");
      return;
    }

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from("articles")
        .delete()
        .in("id", Array.from(selectedArticles));

      if (error) throw error;

      toast.success(`${selectedArticles.size} artikler avvist og slettet`);
      setSelectedArticles(new Set());
      fetchDraftArticles();
      onUpdate();
    } catch (error) {
      console.error("Error bulk rejecting articles:", error);
      toast.error("Feil ved bulk-avvisning");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("articles")
        .update({ published: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Artikkel godkjent og publisert!");
      fetchDraftArticles();
      onUpdate();
    } catch (error) {
      console.error("Error approving article:", error);
      toast.error("Feil ved godkjenning av artikkel");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from("articles")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Artikkel avvist og slettet");
      fetchDraftArticles();
      onUpdate();
    } catch (error) {
      console.error("Error rejecting article:", error);
      toast.error("Feil ved avvisning av artikkel");
    }
  };

  const handleEdit = async () => {
    if (!editingArticle) return;

    try {
      const { error } = await supabase
        .from("articles")
        .update({
          title: editingArticle.title,
          meta_description: editingArticle.meta_description,
          content: editingArticle.content,
          category: editingArticle.category,
        })
        .eq("id", editingArticle.id);

      if (error) throw error;

      toast.success("Artikkel oppdatert!");
      setEditingArticle(null);
      fetchDraftArticles();
      onUpdate();
    } catch (error) {
      console.error("Error updating article:", error);
      toast.error("Feil ved oppdatering av artikkel");
    }
  };

  const handleUpdateQualityScore = async (id: string, score: number) => {
    try {
      const { error } = await supabase
        .from("articles")
        .update({ ai_quality_score: score })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Kvalitetsscore oppdatert til ${Math.round(score * 100)}%`);
      fetchDraftArticles();
    } catch (error) {
      console.error("Error updating quality score:", error);
      toast.error("Feil ved oppdatering av kvalitetsscore");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Laster artikkelutkast...</div>;
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Ingen artikler venter på moderering
        </CardContent>
      </Card>
    );
  }

  // Count high-quality articles
  const highQualityCount = articles.filter(a => 
    (a.ai_quality_score ?? 0) >= 0.75 || (a.ai_status === 'success' && a.content.length > 800)
  ).length;

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {articles.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all"
                    checked={selectedArticles.size === articles.length && articles.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    {selectedArticles.size === articles.length
                      ? "Fjern alle"
                      : "Velg alle"}{" "}
                    ({selectedArticles.size} av {articles.length} valgt)
                  </Label>
                </div>
                
                {selectedArticles.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBulkApprove}
                      disabled={bulkActionLoading}
                      variant="default"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Godkjenn valgte ({selectedArticles.size})
                    </Button>
                    <Button
                      onClick={handleBulkReject}
                      disabled={bulkActionLoading}
                      variant="destructive"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Avvis valgte ({selectedArticles.size})
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Quick actions row */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={selectHighQuality}
                  variant="outline"
                  size="sm"
                  className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Velg høy-kvalitet ({highQualityCount})
                </Button>
                <span className="text-xs text-muted-foreground">
                  Artikler med score ≥75% eller god innholdslengde
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Articles List */}
      {articles.map((article) => (
        <Card key={article.id} className={selectedArticles.has(article.id) ? "ring-2 ring-primary" : ""}>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Checkbox
                checked={selectedArticles.has(article.id)}
                onCheckedChange={() => toggleArticleSelection(article.id)}
                className="mt-1"
              />
              <div className="flex-1 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <Badge variant="secondary">{article.category}</Badge>
                    {article.article_type && article.article_type !== "news" && (
                      <Badge variant="outline" className="capitalize">
                        {article.article_type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(article.created_at).toLocaleString("nb-NO")}
                    </span>
                  </div>

                  {/* AI Quality Score & Status Row */}
                  <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50">
                    {/* Quality Score */}
                    <div className="flex items-center gap-2 min-w-[180px]">
                      {(() => {
                        const qualityInfo = getQualityInfo(article.ai_quality_score);
                        const QualityIcon = qualityInfo.icon;
                        return (
                          <>
                            <QualityIcon className={`h-4 w-4 ${qualityInfo.color}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={qualityInfo.color}>{qualityInfo.label}</span>
                                <span className="text-muted-foreground">
                                  {article.ai_quality_score !== null 
                                    ? `${Math.round(article.ai_quality_score * 100)}%` 
                                    : "—"}
                                </span>
                              </div>
                              <Progress 
                                value={article.ai_quality_score !== null ? article.ai_quality_score * 100 : 0} 
                                className="h-1.5"
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-border" />

                    {/* AI Status */}
                    <div className="flex items-center gap-2">
                      {(() => {
                        const statusInfo = getAiStatusInfo(article.ai_status);
                        return (
                          <Badge variant="outline" className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        );
                      })()}
                    </div>

                    {/* Auto-publish indicator */}
                    {article.ai_quality_score !== null && article.ai_quality_score >= 0.75 && (
                      <>
                        <div className="w-px h-6 bg-border" />
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">
                          <Zap className="h-3 w-3 mr-1" />
                          Auto-publish klar
                        </Badge>
                      </>
                    )}

                    {/* Word count */}
                    <div className="w-px h-6 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {article.content.split(/\s+/).length} ord
                    </span>
                  </div>

                  <CardTitle className="text-xl mb-2">{article.title}</CardTitle>
                  <CardDescription>{article.meta_description}</CardDescription>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <span>Kilde: {article.source_name}</span>
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                {article.image_url && (
                <div className="w-48 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            
            <div className="prose prose-sm max-w-none mb-4 max-h-32 overflow-hidden text-muted-foreground">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content.substring(0, 300) + '...') }} />
            </div>

            {/* Manual quality score override */}
            <div className="mb-4 p-3 border rounded-lg bg-muted/30">
              <Label className="text-xs font-medium">Manuell kvalitetsjustering</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  value={[article.ai_quality_score ?? 0.5]}
                  onValueChange={([value]) => setManualScore(value)}
                  max={1}
                  min={0}
                  step={0.05}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12">{Math.round(manualScore * 100)}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateQualityScore(article.id, manualScore)}
                >
                  Oppdater
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleApprove(article.id)}
                variant="default"
                size="sm"
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Godkjenn
              </Button>

              {/* Preview Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => setPreviewArticle(article)}
                    variant="outline"
                    size="sm"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Forhåndsvis
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Forhåndsvisning</DialogTitle>
                  </DialogHeader>
                  {previewArticle && (
                    <div className="space-y-4">
                      {previewArticle.image_url && (
                        <img 
                          src={previewArticle.image_url} 
                          alt={previewArticle.title}
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      )}
                      <Badge>{previewArticle.category}</Badge>
                      <h2 className="text-2xl font-bold">{previewArticle.title}</h2>
                      <p className="text-muted-foreground">{previewArticle.meta_description}</p>
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewArticle.content.replace(/\n/g, '<br/>')) }} />
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => setEditingArticle(article)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Rediger
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Rediger artikkel</DialogTitle>
                  </DialogHeader>
                  {editingArticle && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Tittel</Label>
                        <Input
                          id="title"
                          value={editingArticle.title}
                          onChange={(e) =>
                            setEditingArticle({ ...editingArticle, title: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="meta">Meta beskrivelse</Label>
                        <Textarea
                          id="meta"
                          value={editingArticle.meta_description || ""}
                          onChange={(e) =>
                            setEditingArticle({ ...editingArticle, meta_description: e.target.value })
                          }
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Kategori</Label>
                        <Input
                          id="category"
                          value={editingArticle.category}
                          onChange={(e) =>
                            setEditingArticle({ ...editingArticle, category: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="content">Innhold</Label>
                        <Textarea
                          id="content"
                          value={editingArticle.content}
                          onChange={(e) =>
                            setEditingArticle({ ...editingArticle, content: e.target.value })
                          }
                          rows={15}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleEdit} className="flex-1">
                          Lagre endringer
                        </Button>
                        <Button
                          onClick={() => {
                            handleApprove(editingArticle.id);
                            setEditingArticle(null);
                          }}
                          variant="default"
                        >
                          Lagre og publiser
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => handleReject(article.id)}
                variant="destructive"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Avvis
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
