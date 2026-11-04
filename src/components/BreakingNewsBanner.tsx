import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BreakingArticle {
  id: string;
  title: string;
  slug: string;
  created_at: string;
}

export const BreakingNewsBanner = () => {
  const [breakingArticle, setBreakingArticle] = useState<BreakingArticle | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fetchBreakingNews = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, created_at")
        .eq("published", true)
        .gte("created_at", oneHourAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setBreakingArticle(data);
        
        const articleTime = new Date(data.created_at).getTime();
        const twoHoursFromArticle = articleTime + 2 * 60 * 60 * 1000;
        const hideAfter = twoHoursFromArticle - Date.now();
        
        if (hideAfter > 0) {
          setTimeout(() => setIsVisible(false), hideAfter);
        } else {
          setIsVisible(false);
        }
      }
    };

    fetchBreakingNews();
  }, []);

  if (!breakingArticle || !isVisible) return null;

  return (
    <div className="border-b border-border py-2.5 mb-6">
      <Link
        to={`/${breakingArticle.slug}`}
        className="flex items-center gap-3 group"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-destructive whitespace-nowrap" style={{ fontFamily: "'Inter', sans-serif" }}>
          Akkurat nå
        </span>
        <span className="text-border">|</span>
        <span className="text-sm font-medium text-foreground truncate group-hover:underline decoration-1 underline-offset-2">
          {breakingArticle.title}
        </span>
      </Link>
    </div>
  );
};
