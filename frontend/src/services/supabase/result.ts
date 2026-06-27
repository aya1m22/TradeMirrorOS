import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Error thrown when a Supabase/PostgREST call fails. Carries the original
 * PostgrestError so callers (and error boundaries) can inspect codes.
 */
export class SupabaseError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(error: PostgrestError) {
    super(error.message);
    this.name = "SupabaseError";
    this.code = error.code;
    this.details = error.details;
  }
}

interface PostgrestResult<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Unwrap a required result (e.g. `.single()`), throwing on error. */
export function unwrap<T>(result: PostgrestResult<T>): T {
  if (result.error) throw new SupabaseError(result.error);
  return result.data as T;
}

/** Unwrap a nullable result (e.g. `.maybeSingle()`); returns null if absent. */
export function unwrapMaybe<T>(result: PostgrestResult<T>): T | null {
  if (result.error) throw new SupabaseError(result.error);
  return result.data;
}

/** Unwrap a list result, normalizing a null payload to an empty array. */
export function unwrapList<T>(result: PostgrestResult<T[]>): T[] {
  if (result.error) throw new SupabaseError(result.error);
  return result.data ?? [];
}
