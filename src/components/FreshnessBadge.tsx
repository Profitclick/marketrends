import { getFreshness, relativeTimeNo } from "@/lib/freshness";

interface Props {
  date: string | Date;
  showLabel?: boolean;
  className?: string;
}

export const FreshnessBadge = ({ date, showLabel = true, className = "" }: Props) => {
  const f = getFreshness(date);
  const rel = relativeTimeNo(date);

  if (f === "live") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-destructive ${className}`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
        </span>
        {showLabel ? "Akkurat nå" : rel}
      </span>
    );
  }
  if (f === "fresh") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-destructive ${className}`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {showLabel ? "Oppdatert" : ""} {rel}
      </span>
    );
  }
  return (
    <span
      className={`text-[10px] uppercase tracking-wider text-muted-foreground ${className}`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {rel}
    </span>
  );
};
