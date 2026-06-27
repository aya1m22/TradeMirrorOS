/**
 * Supabase connectivity check.
 *
 * Reads .env, normalizes the URL, and pings the Auth health endpoint and the
 * PostgREST root using the anon key. Prints HTTP statuses only — never secrets.
 *
 *   node scripts/check-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const out = {};
  // Env lives in the frontend workspace (Vite reads it there); a backend-local
  // .env / .env.local (e.g. the service role key) overrides it.
  const dirs = [join(root, "..", "frontend"), root];
  for (const dir of dirs) {
    for (const name of [".env", ".env.local"]) {
      try {
        const text = readFileSync(join(dir, name), "utf8");
        for (const line of text.split(/\r?\n/)) {
          const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
          if (m) out[m[1]] = m[2].trim();
        }
      } catch {
        /* file may not exist */
      }
    }
  }
  return out;
}

function normalizeUrl(raw = "") {
  const v = raw.trim().replace(/\/+$/, "");
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}.supabase.co`;
}

const env = loadEnv();
const url = normalizeUrl(env.VITE_SUPABASE_URL);
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("✗ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

console.log(`Target: ${url}`);

async function ping(label, path, headers = {}) {
  try {
    const res = await fetch(`${url}${path}`, { headers });
    const ok = res.status >= 200 && res.status < 500; // reachable & responding
    console.log(`${ok ? "✓" : "✗"} ${label}: HTTP ${res.status}`);
    return ok;
  } catch (err) {
    console.log(`✗ ${label}: ${err.message}`);
    return false;
  }
}

const auth = await ping("Auth health", "/auth/v1/health", { apikey: key });

// Probe a table: 200 (exists) or 404/PGRST205 (key accepted, not migrated yet)
// both mean the anon key passed PostgREST auth. 401/403 means it was rejected.
let restOk = false;
try {
  const res = await fetch(`${url}/rest/v1/users?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  const notMigrated = res.status === 404 && body.includes("PGRST205");
  restOk = res.status === 200 || notMigrated;
  const note = notMigrated ? " (table not created yet — expected pre-migration)" : "";
  console.log(`${restOk ? "✓" : "✗"} REST anon-key auth: HTTP ${res.status}${note}`);
} catch (err) {
  console.log(`✗ REST anon-key auth: ${err.message}`);
}

if (auth && restOk) {
  console.log("\nConnection OK — project reachable and the anon key is accepted.");
  process.exit(0);
} else {
  console.error("\nConnection check failed.");
  process.exit(1);
}
