import { Badge } from "@/components/ui/badge";
import { Zap, BarChart3, BookOpen, Sparkles, TrendingUp } from "lucide-react";

interface ArticleTypeBadgeProps {
  type: string | null;
  size?: "sm" | "md";
}

export const ArticleTypeBadge = ({ type, size = "sm" }: ArticleTypeBadgeProps) => {
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  switch (type) {
    case 'breaking':
      return (
        <Badge variant="destructive" className={`${sizeClasses} gap-1 font-semibold animate-pulse`}>
          <Zap className={iconSize} />
          Akkurat nå
        </Badge>
      );
    case 'analysis':
      return (
        <Badge variant="secondary" className={`${sizeClasses} gap-1 bg-blue-100 text-blue-800`}>
          <BarChart3 className={iconSize} />
          Analyse
        </Badge>
      );
    case 'guide':
      return (
        <Badge variant="outline" className={`${sizeClasses} gap-1 border-emerald-500 text-emerald-700`}>
          <BookOpen className={iconSize} />
          Guide
        </Badge>
      );
    case 'feature':
      return (
        <Badge variant="secondary" className={`${sizeClasses} gap-1 bg-purple-100 text-purple-800`}>
          <Sparkles className={iconSize} />
          Feature
        </Badge>
      );
    case 'tabloid':
    case 'news':
      return null; // Standard nyheter trenger ikke badge
    default:
      return null;
  }
};
