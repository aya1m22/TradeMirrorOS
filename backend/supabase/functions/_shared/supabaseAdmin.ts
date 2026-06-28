// Shared service-role Supabase client + app-URL resolution for the Edge runtime.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
