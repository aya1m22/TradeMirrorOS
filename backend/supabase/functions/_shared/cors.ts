// Shared CORS + JSON helpers for the Edge Functions.
//
// Every function is invoked from the browser (supabase-js `functions.invoke`),
// so each must answer the CORS preflight and echo permissive headers. Origin is
// "*" because these endpoints are either token-authed (accept/reset) or verify
// the caller's JWT themselves (invite-user) — they don't rely on the browser
// origin for security.

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Standard JSON response with CORS headers attached. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Answer a CORS preflight, or null when the request isn't one. */
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  return null;
}
