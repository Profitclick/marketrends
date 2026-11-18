export const GSC_PAGE_SIZE = 25_000;
export const GSC_MAX_ROWS_PER_DAY = 50_000;
export const GSC_SYNC_CONCURRENCY = 4;

export function reportingDays(endDate: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('days must be 1..90');
  const end = Date.parse(endDate + 'T00:00:00Z');
  if (!Number.isFinite(end)) throw new Error('invalid end date');
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10)
  );
}

export function pageStarts(): number[] {
  return Array.from(
    { length: GSC_MAX_ROWS_PER_DAY / GSC_PAGE_SIZE },
    (_, index) => index * GSC_PAGE_SIZE
  );
}
