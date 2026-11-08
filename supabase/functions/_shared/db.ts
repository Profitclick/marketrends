// Shared database client type for edge-function helpers (schema is untyped at the edge).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Db = SupabaseClient;
