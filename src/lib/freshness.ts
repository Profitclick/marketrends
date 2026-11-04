// Norwegian relative-time + freshness helpers for newsroom UI
export type Freshness = "live" | "fresh" | "today" | "recent" | "older";

export function getFreshness(date: string | Date): Freshness {
  const t = new Date(date).getTime();
  const mins = (Date.now() - t) / 60000;
  if (mins < 60) return "live";
  if (mins < 6 * 60) return "fresh";
  if (mins < 24 * 60) return "today";
  if (mins < 72 * 60) return "recent";
  return "older";
}

export function relativeTimeNo(date: string | Date): string {
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "akkurat nå";
  if (mins < 60) return `${mins} min siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d siden`;
  return new Date(date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}
