// Shared service-role Supabase client + app-URL resolution for the Edge runtime.
//
// Import is a fully-qualified URL (not the bare "@supabase/supabase-js"
// specifier): the Supabase CLI bundler does not apply the functions/deno.json
// import map to files under _shared, so a bare specifier fails to bundle with
// 'Relative import path … not prefixed with / or ./ or ../'. A URL always
// resolves on the Deno Edge runtime.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

/**
 * Service-role client. Bypasses RLS, so it must only ever run server-side (an
 * Edge Function), never the browser. Throws if the runtime secrets are missing
 * rather than silently building a broken client.
 */
export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "Server is not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Canonical base URL the emailed links point at (no trailing slash). Prefers the
 * configured APP_URL; falls back to the caller's Origin so local dev works
 * without extra setup.
 */
export function getAppBaseUrl(req: Request): string {
  const configured = Deno.env.get("APP_URL")?.trim();
  const base = configured || req.headers.get("origin") || "";
  return base.replace(/\/+$/, "");
}
