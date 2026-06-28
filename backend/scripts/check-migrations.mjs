/**
 * Migration check — executes the migrations and seed against a real Postgres
 * running in-process (PGlite / WASM). No Docker, no remote DB needed.
 *
 * Supabase platform objects (the auth + storage schemas, auth.uid(), the
 * authenticated role) don't exist in a bare Postgres, so a small shim creates
 * just enough of them for the migrations to run. This validates the table,
 * enum, relationship, generated-column, trigger, policy, and seed SQL — i.e.
 * everything we authored — short of the live platform's own objects.
 *
 *   node scripts/check-migrations.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

// Minimal stand-ins for Supabase-managed objects the migrations depend on.
const SUPABASE_SHIM = `
  create role anon;
  create role authenticated;
  create role service_role;

  create schema if not exists auth;
  -- Mirror the columns of Supabase's auth.users that our migrations reference
  -- (id for FKs, email for the invite/reset account lookup). Real auth.users has
  -- many more, but these are all the authored SQL touches.
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $$ select null::uuid $$;

  create schema if not exists storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean not null default false
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text
  );
  alter table storage.objects enable row level security;
`;

async function run() {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    try {
      await db.exec(sql);
      console.log(`✓ ${file}`);
    } catch (err) {
      console.error(`✗ ${file}\n  ${err.message}`);
      process.exit(1);
    }
  }

  // Seed runs against the applied schema.
  try {
    await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
    console.log("✓ seed.sql");
  } catch (err) {
    console.error(`✗ seed.sql\n  ${err.message}`);
    process.exit(1);
  }

  // Sanity counts to prove the seed actually landed.
  const checks = [
    ["entities", 2],
    ["bank_profiles", 1],
    ["clients", 1],
    ["contacts", 1],
  ];
  for (const [table, expected] of checks) {
    const res = await db.query(`select count(*)::int as n from public.${table}`);
    const n = res.rows[0].n;
    const ok = n === expected;
    console.log(`${ok ? "✓" : "✗"} seed ${table}: ${n} row(s)`);
    if (!ok) process.exit(1);
  }

  console.log("\nMigration check passed — schema, policies, and seed all apply cleanly.");
}

run();
