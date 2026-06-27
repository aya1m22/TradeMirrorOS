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
import type { AppUser, AuthContextValue, AuthStatus } from "../types";

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Tracks the Supabase session and resolves the signed-in user's profile row
 * (which carries the role). Establishes the auth state on mount from the
 * persisted Supabase session only — no auto-login — and keeps it in sync via
 * `onAuthStateChange`. With no session the app renders the Login page.
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
      .then((existing) => applySession(existing))
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
    try {
      await authService.signOut();
    } catch (e) {
      // Even if the network sign-out fails, clear the local session so the user
      // is reliably logged out — never leave a stale/half-authenticated state.
      console.error("[auth] Sign-out request failed; clearing local session anyway.", e);
    } finally {
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
    }
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
