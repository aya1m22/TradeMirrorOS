import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "./types.generated";

/**
 * Single Supabase client for the app, typed against the generated Database
 * schema so every `.from("table")` call is fully type-checked.
 *
 * Created with the anon key only — Row Level Security (added in a later step)
 * is what scopes data per role. The service_role key is never used here.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
