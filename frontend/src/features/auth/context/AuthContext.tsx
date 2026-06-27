import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { authService } from "../services/authService";
import { devAutoLogin } from "@/config/env";
import type { AppUser, AuthContextValue, AuthStatus } from "../types";

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tracks the Supabase session and resolves the signed-in user's profile row
 * (which carries the role). Establishes the auth state on mount and keeps it
 * in sync via `onAuthStateChange`. Login screens and route guards consume this
 * in later steps; for now it simply resolves to `unauthenticated`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const mounted = useRef(true);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setUser(null);
      setStatus("unauthenticated");
      return;
    }
    try {
      const profile = await authService.getProfile(next.user.id);
      if (!mounted.current) return;
      setUser(profile);
    } catch {
      // Profile fetch failing shouldn't strand the app; treat as no profile.
      if (mounted.current) setUser(null);
    }
    if (mounted.current) setStatus("authenticated");
  }, []);

  useEffect(() => {
    mounted.current = true;

    authService
      .getSession()
      .then(async (existing) => {
        let session = existing;
        // Dev-only: establish a real session automatically when configured.
        if (!session && devAutoLogin) {
          try {
            session = await authService.signIn(devAutoLogin.email, devAutoLogin.password);
          } catch (e) {
            console.warn("[auth] dev auto-login failed:", e instanceof Error ? e.message : e);
          }
        }
        await applySession(session);
      })
      .catch(() => {
        if (mounted.current) setStatus("unauthenticated");
      });

    const unsubscribe = authService.onAuthStateChange((next) => {
      void applySession(next);
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await authService.signIn(email, password);
    await applySession(next);
  }, [applySession]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user,
      role: user?.role ?? null,
      signIn,
      signOut,
    }),
    [status, session, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
