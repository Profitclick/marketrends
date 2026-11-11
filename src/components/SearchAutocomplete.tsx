import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[] | null;
  created_at: string;
}

export const SearchAutocomplete = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchTerm = `%${query}%`;
        
        const { data, error } = await supabase
          .from("articles")
          .select("id, title, slug, category, tags, created_at")
          .eq("published", true)
          .or(`title.ilike.${searchTerm},tags.cs.{\"${query.toLowerCase()}\"}`)
          .order("created_at", { ascending: false })
          .limit(8);

        if (error) throw error;

        const filteredData = data || [];
        setResults(filteredData.slice(0, 8));
        setIsOpen(filteredData.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (article: Article) => {
    navigate(`/${article.slug}`);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "Akkurat nå";
    if (diffHours < 24) return `${diffHours}t siden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "I går";
    if (diffDays < 7) return `${diffDays}d siden`;
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Søk artikler..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9 h-9 w-full rounded text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          style={{ fontFamily: "'Inter', sans-serif" }}
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded shadow-lg overflow-hidden z-50 min-w-[300px] lg:min-w-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Søker...
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {results.map((article, index) => (
                <li key={article.id}>
                  <button
                    onClick={() => handleSelect(article)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                      selectedIndex === index && "bg-muted"
                    )}
                  >
                    <p className="font-semibold text-sm line-clamp-2 leading-snug text-foreground">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {article.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(article.created_at)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Ingen resultater for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
