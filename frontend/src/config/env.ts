/**
 * Validated, typed access to build-time environment variables.
 *
 * Vite only exposes vars prefixed with `VITE_` to the client bundle. We read
 * and validate them once here so the rest of the app imports a typed `env`
 * object instead of touching `import.meta.env` directly.
 */

export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  useMocks: boolean;
}

/** Accepts a full URL or a bare Supabase project ref and returns a full URL. */
export function normalizeSupabaseUrl(raw: string): string {
  const value = raw.trim().replace(/\/+$/, "");
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}.supabase.co`;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === "true";
}

function readEnv(): AppEnv {
  const useMocks = parseBool(import.meta.env.VITE_USE_MOCKS, false);
  const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? "");
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  // Defensive: a service_role key in the client bundle bypasses RLS entirely.
  if (import.meta.env.DEV && import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[security] A service_role key is present in client env. Remove it — " +
        "it must never be bundled into the browser. Use the anon key here.",
    );
  }

  // Supabase is only required when not running on mock fixtures.
  if (!useMocks) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
          `Set them in .env, or set VITE_USE_MOCKS=true to run on fixtures.`,
      );
    }
  }

  return { supabaseUrl, supabaseAnonKey, useMocks };
}

export const env: AppEnv = readEnv();

/** True when the app should read mock fixtures instead of Supabase. */
export const isMockMode = env.useMocks;
