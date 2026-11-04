import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

interface Match { id: string; slug: string; name: string; type: string; }

export const EntitySearch = () => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      // Fuzzy + alias search. ilike on name + aliases.
      const { data } = await supabase
        .from("entities")
        .select("id, slug, name, type, aliases")
        .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
        .order("mention_count", { ascending: false })
        .limit(8);
      setResults((data as any) || []);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Søk aktører, selskaper, personer…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-background border border-border shadow-lg max-h-80 overflow-auto">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                to={`/entity/${r.slug}`}
                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted text-sm"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.type}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
