type DatePattern = "HH:mm" | "d. MMM yyyy" | "d. MMMM yyyy" | "d. MMM";
export function formatOsloDate(date: string | Date, pattern: DatePattern): string {
  const options: Intl.DateTimeFormatOptions = pattern === "HH:mm"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { day: "numeric", month: pattern === "d. MMMM yyyy" ? "long" : "short", ...(pattern.endsWith("yyyy") ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat("nb-NO", { ...options, timeZone: "Europe/Oslo" }).format(new Date(date));
}
