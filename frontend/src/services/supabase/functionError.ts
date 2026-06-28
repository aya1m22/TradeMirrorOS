/**
 * Helpers for reading Edge Function error responses.
 *
 * supabase-js wraps a non-2xx Edge Function response in a FunctionsHttpError
 * whose `context` is the raw Response — the default `error.message` is just the
 * opaque "Edge Function returned a non-2xx status code". Our functions return
 * the real reason as JSON `{ error, code? }`, so read that instead.
 */

export interface EdgeError {
  /** Human-readable reason from the function's JSON body, if present. */
  message: string | null;
  /** Machine code (e.g. "expired", "used", "invalid"), if present. */
  code: string | null;
}

/** Parse `{ error, code }` out of a supabase-js function error. */
export async function parseFunctionError(error: unknown): Promise<EdgeError> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const data = await ctx.clone().json();
      return {
        message: typeof data?.error === "string" ? data.error : null,
        code: typeof data?.code === "string" ? data.code : null,
      };
    } catch {
      // Body wasn't JSON — fall through to the generic null result.
    }
  }
  return { message: null, code: null };
}

/**
 * True when invoke failed before getting a response (offline, CORS, function
 * not deployed). supabase-js surfaces this as a FunctionsFetchError.
 */
export function isFunctionNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : "";
  return (
    /Failed to send a request to the Edge Function/i.test(msg) ||
    /Failed to fetch/i.test(msg) ||
    error instanceof TypeError
  );
}
