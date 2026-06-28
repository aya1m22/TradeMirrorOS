// Deploy the TradeMirror Edge Functions and push their Brevo secrets.
//
// Deploys: invite-user, accept-invitation, request-password-reset,
//          reset-password, milestone-alerts.
//
// Prereq — authenticate the Supabase CLI ONCE (this part is yours, it needs a
// browser / personal access token):
//     npx supabase login                       # opens a browser, or
//     $env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # paste a token from
//                                              # https://supabase.com/dashboard/account/tokens
//
// Then run:   node backend/scripts/deploy-invite-user.mjs
//
// It: (1) pushes BREVO_* (+ APP_URL, ALERT_TO_EMAIL) from backend/.env so the
//         branded Brevo emails work, and
//     (2) deploys every function. The three public functions
//         (accept-invitation, request-password-reset, reset-password) are
//         deployed with --no-verify-jwt because they're token-authenticated and
//         called by signed-out users; the others keep JWT verification.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const backendDir = resolve(repoRoot, "backend");

// Functions to deploy, with whether the JWT gateway check should be skipped.
const FUNCTIONS = [
  { name: "invite-user", noVerifyJwt: false },
  { name: "accept-invitation", noVerifyJwt: true },
  { name: "request-password-reset", noVerifyJwt: true },
  { name: "reset-password", noVerifyJwt: true },
  { name: "milestone-alerts", noVerifyJwt: false },
];

// Resolve the bundled Supabase CLI binary (installed as a dev dependency).
function resolveSupabaseBin() {
  const candidates = [
    resolve(repoRoot, "node_modules/@supabase/cli-windows-x64/bin/supabase.exe"),
    resolve(repoRoot, "node_modules/@supabase/cli-windows-arm64/bin/supabase.exe"),
    resolve(repoRoot, "node_modules/@supabase/cli-linux-x64/bin/supabase"),
    resolve(repoRoot, "node_modules/@supabase/cli-linux-arm64/bin/supabase"),
    resolve(repoRoot, "node_modules/@supabase/cli-darwin-x64/bin/supabase"),
    resolve(repoRoot, "node_modules/@supabase/cli-darwin-arm64/bin/supabase"),
    resolve(repoRoot, "node_modules/.bin/supabase"),
  ];
  return candidates.find((p) => existsSync(p)) ?? "supabase"; // fall back to PATH
}

// Minimal .env reader (KEY=VALUE, ignores comments/blank lines, strips quotes).
function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_ID) return process.env.SUPABASE_PROJECT_ID;
  const fe = readEnv(resolve(repoRoot, "frontend/.env"));
  if (fe.VITE_SUPABASE_PROJECT_ID) return fe.VITE_SUPABASE_PROJECT_ID;
  const url = fe.VITE_SUPABASE_URL ?? "";
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (m) return m[1];
  throw new Error("Could not determine project ref. Set SUPABASE_PROJECT_ID or VITE_SUPABASE_PROJECT_ID in frontend/.env.");
}

const SB = resolveSupabaseBin();
const REF = projectRef();

function run(args, opts = {}) {
  console.log(`\n$ supabase ${args.join(" ")}`);
  const r = spawnSync(SB, args, { stdio: "inherit", cwd: backendDir, shell: false, ...opts });
  if (r.status !== 0) {
    if (r.error) console.error(r.error.message);
    process.exit(r.status ?? 1);
  }
}

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  // Not fatal — the CLI may already hold a session from `supabase login`.
  console.log("Note: SUPABASE_ACCESS_TOKEN not set. Relying on a prior `supabase login` session.");
  console.log("If the deploy fails with an auth error, run `npx supabase login` first.\n");
}

console.log(`Deploying TradeMirror Edge Functions to project ${REF} ...`);

// 1) Push secrets from backend/.env so the Brevo emails work.
const env = readEnv(resolve(backendDir, ".env"));
const secretArgs = [];
for (const key of ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME", "APP_URL", "ALERT_TO_EMAIL"]) {
  const v = env[key];
  if (v) secretArgs.push(`${key}=${v}`);
}
if (secretArgs.length) {
  run(["secrets", "set", ...secretArgs, "--project-ref", REF]);
} else {
  console.log("No deployable secrets found in backend/.env — skipping secrets push.");
  console.log("(Emails will be skipped until BREVO_API_KEY + BREVO_SENDER_EMAIL are set.)");
}

// 2) Deploy each function.
for (const fn of FUNCTIONS) {
  const args = ["functions", "deploy", fn.name, "--project-ref", REF];
  if (fn.noVerifyJwt) args.push("--no-verify-jwt");
  run(args);
}

console.log("\n✅ Functions deployed. Try sending an invite or a password reset from the app.");
