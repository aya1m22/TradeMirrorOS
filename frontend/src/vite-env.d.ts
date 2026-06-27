/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_USE_MOCKS?: string;
  /** Dev-only auto sign-in credentials (real account; RLS still applies). */
  readonly VITE_DEV_AUTOLOGIN_EMAIL?: string;
  readonly VITE_DEV_AUTOLOGIN_PASSWORD?: string;
  /** Present only by mistake — must never be set in client env (see config/env.ts). */
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
