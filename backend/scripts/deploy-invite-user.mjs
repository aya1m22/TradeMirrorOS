// Deploy the `invite-user` Edge Function and push its secrets (PRD §2.2/§2.4).
//
// Fixes the runtime error: "The Edge Function 'invite-user' is not deployed".
// The function exists in source (backend/supabase/functions/invite-user) but has
// to be deployed to the live Supabase project before the app can invoke it.
//
// Prereq — authenticate the Supabase CLI ONCE (this part is yours, it needs a
// browser / personal access token):
//     npx supabase login                       # opens a browser, or
//     $env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # paste a token from
//                                              # https://supabase.com/dashboard/account/tokens
//
// Then run:   node backend/scripts/deploy-invite-user.mjs
//
// It: (1) deploys the function to the project ref in frontend/.env, and
//     (2) pushes RESEND_API_KEY (+ alert secrets) from backend/.env so the
//         branded Resend invite email works. Without RESEND_API_KEY the function
//         still works, falling back to Supabase Auth's built-in invite mailer.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const backendDir = resolve(repoRoot, "backend");

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
const PLACEHOLDER = "your_resend_api_key_here";

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

console.log(`Deploying invite-user to project ${REF} ...`);

// 1) Push secrets from backend/.env so the Resend invite email works.
const env = readEnv(resolve(backendDir, ".env"));
const secretArgs = [];
for (const key of ["RESEND_API_KEY", "INVITE_FROM_EMAIL", "ALERT_FROM_EMAIL", "ALERT_TO_EMAIL", "APP_URL"]) {
  const v = env[key];
  if (v && v !== PLACEHOLDER) secretArgs.push(`${key}=${v}`);
}
if (secretArgs.length) {
  run(["secrets", "set", ...secretArgs, "--project-ref", REF]);
} else {
  console.log("No deployable secrets found in backend/.env — skipping secrets push.");
  console.log("(invite-user will fall back to Supabase Auth's built-in invite mailer.)");
}

// 2) Deploy the function.
run(["functions", "deploy", "invite-user", "--project-ref", REF]);

console.log("\n✅ invite-user deployed. Try sending an invite again from the app.");
