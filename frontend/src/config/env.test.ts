import { describe, it, expect } from "vitest";
import { normalizeSupabaseUrl } from "./env";

const REF = "xwvdktfhfadlwoqjkqcb";
const ORIGIN = `https://${REF}.supabase.co`;

describe("normalizeSupabaseUrl", () => {
  it("passes a clean project URL through unchanged", () => {
    expect(normalizeSupabaseUrl(ORIGIN)).toBe(ORIGIN);
  });

  it("expands a bare project ref to a full URL", () => {
    expect(normalizeSupabaseUrl(REF)).toBe(ORIGIN);
  });

  it("strips a trailing slash", () => {
    expect(normalizeSupabaseUrl(`${ORIGIN}/`)).toBe(ORIGIN);
  });

  // Regression: a /rest/v1 (or any path) suffix on VITE_SUPABASE_URL nests the
  // auth call under /rest/v1/auth/v1/token → PostgREST PGRST125
  // "Invalid path specified in request URL". The origin must always win.
  it("drops a /rest/v1 path suffix that would break auth", () => {
    expect(normalizeSupabaseUrl(`${ORIGIN}/rest/v1`)).toBe(ORIGIN);
    expect(normalizeSupabaseUrl(`${ORIGIN}/rest/v1/`)).toBe(ORIGIN);
  });

  it("drops any other API path suffix", () => {
    expect(normalizeSupabaseUrl(`${ORIGIN}/auth/v1`)).toBe(ORIGIN);
    expect(normalizeSupabaseUrl(`${ORIGIN}/storage/v1/object`)).toBe(ORIGIN);
    expect(normalizeSupabaseUrl(`${ORIGIN}/rest/v1?apikey=x`)).toBe(ORIGIN);
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSupabaseUrl(`  ${ORIGIN}  `)).toBe(ORIGIN);
  });

  it("preserves a self-hosted host:port origin", () => {
    expect(normalizeSupabaseUrl("http://localhost:54321/rest/v1")).toBe("http://localhost:54321");
  });

  it("returns empty for an empty value (so the missing-var guard still fires)", () => {
    expect(normalizeSupabaseUrl("")).toBe("");
    expect(normalizeSupabaseUrl("   ")).toBe("");
  });
});
