import { ShieldCheck } from "lucide-react";

interface Props { score: number; label?: string; className?: string }

export const AuthorityBadge = ({ score, label = "Autoritet", className = "" }: Props) => {
  const s = Math.round(score || 0);
  const tone =
    s >= 70 ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : s >= 40 ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium ${tone} ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5" /> {label} {s}
    </span>
  );
};
