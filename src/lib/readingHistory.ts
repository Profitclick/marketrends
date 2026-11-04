// Lightweight, no-auth reading history stored in localStorage.
// Used to power "Recommended For You" without DB writes or cookies.

const KEY = "mt:read-history:v1";
const MAX = 20;

export interface ReadEntry {
  slug: string;
  id?: string;
  category?: string;
  title?: string;
  at: number;
}

export function getReadingHistory(): ReadEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logRead(entry: Omit<ReadEntry, "at">) {
  if (typeof window === "undefined") return;
  try {
    const list = getReadingHistory().filter((e) => e.slug !== entry.slug);
    list.unshift({ ...entry, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore
  }
}

export function lastReadId(): string | undefined {
  return getReadingHistory().find((e) => !!e.id)?.id;
}

export function recentReadCategories(n = 5): string[] {
  const cats = getReadingHistory()
    .map((e) => e.category)
    .filter(Boolean) as string[];
  return Array.from(new Set(cats)).slice(0, n);
}

export function recentReadSlugs(): Set<string> {
  return new Set(getReadingHistory().map((e) => e.slug));
}
