/**
 * Seed the three platform users (SuperAdmin / Internal / Partner).
 *
 * Auth users must be created through Supabase Auth, so this runs server-side
 * with the service_role key (never the browser). It creates each auth user
 * (idempotently) and upserts the matching public.users profile row.
 *
 * Prerequisites: migrations applied (the users table must exist), and the
 * service_role key available WITHOUT a VITE_ prefix:
 *
 *   # .env.local (gitignored)
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...   # rotate first if it was ever committed
 *
 *   node scripts/seed-auth-users.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const out = { ...process.env };
  // Backend-local env first (service role key), then the frontend's .env (URL/anon).
  const dirs = [root, join(root, "..", "frontend")];
  for (const dir of dirs) {
    for (const name of [".env", ".env.local"]) {
      try {
        for (const line of readFileSync(join(dir, name), "utf8").split(/\r?\n/)) {
          const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
          if (m && out[m[1]] === undefined) out[m[1]] = m[2].trim();
        }
      } catch {
        /* optional */
      }
    }
  }
  return out;
}

function normalizeUrl(raw = "") {
  const v = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : v ? `https://${v}.supabase.co` : v;
}

const env = loadEnv();
const url = normalizeUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "  Add SUPABASE_SERVICE_ROLE_KEY to .env.local (no VITE_ prefix) and retry.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = env.SEED_USER_PASSWORD || "TradeMirror!2026";

const USERS = [
  { email: "superadmin@chipafarm.com", full_name: "Chipa Owner", role: "super_admin" },
  { email: "internal@chipafarm.com", full_name: "Internal Staff", role: "internal" },
  { email: "partner@chipafarm.com", full_name: "Finance Partner", role: "partner" },
];

async function findUserByEmail(email) {
  // Paginate the admin user list to locate an existing account.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser({ email, full_name, role }) {
  let authUser = null;
  const created = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (created.error) {
    // Already exists → look it up rather than failing the whole seed.
    authUser = await findUserByEmail(email);
    if (!authUser) throw created.error;
    console.log(`• ${email}: auth user already present`);
  } else {
    authUser = created.data.user;
    console.log(`• ${email}: auth user created`);
  }

  const { error: profileError } = await admin
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email,
        full_name,
        role,
        is_active: true,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (profileError) throw profileError;
  console.log(`  ↳ profile upserted as ${role}`);
}

console.log(`Seeding platform users on ${url}`);
for (const u of USERS) {
  await ensureUser(u);
}
console.log(`\nDone. Default password for all seeded users: ${DEFAULT_PASSWORD}`);
