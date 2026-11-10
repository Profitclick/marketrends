// Minimal typed view of the (untyped) Supabase client used by edge functions.
// Keeps call sites honest without changing any query semantics.

export type Row = Record<string, unknown>;

export interface DbError {
  message: string;
}

export interface DbResult<T = Row> {
  data: T[] | null;
  error: DbError | null;
}

export interface DbSingle<T = Row> {
  data: T | null;
  error: DbError | null;
}

export interface DbQuery<T = Row> extends PromiseLike<DbResult<T>> {
  select(columns?: string): DbQuery<T>;
  eq(column: string, value: unknown): DbQuery<T>;
  neq(column: string, value: unknown): DbQuery<T>;
  in(column: string, values: unknown[]): DbQuery<T>;
  not(column: string, operator: string, value: unknown): DbQuery<T>;
  ilike(column: string, pattern: string): DbQuery<T>;
  gte(column: string, value: unknown): DbQuery<T>;
  order(column: string, opts?: { ascending?: boolean }): DbQuery<T>;
  limit(n: number): DbQuery<T>;
  maybeSingle(): PromiseLike<DbSingle<T>>;
}

/** Table entry point: mirrors PostgrestQueryBuilder before .select() is called. */
export interface DbFrom {
  select(columns?: string): DbQuery;
  insert(values: unknown): PromiseLike<DbResult>;
  upsert(values: unknown, opts?: { onConflict?: string }): PromiseLike<DbResult>;
  update(values: unknown): DbQuery;
  delete(): DbQuery;
}

export interface DbClient {
  from(table: string): DbFrom;
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<DbResult>;
}

/** Narrow an unknown row field to a string, or fall back. */
export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Narrow an unknown row field to a string array. */
export function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Error message from an unknown caught value. */
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
