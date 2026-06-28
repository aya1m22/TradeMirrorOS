import type { ReactNode } from "react";

/**
 * Shared shell for the signed-out auth screens (forgot password, accept invite,
 * reset password). Mirrors the LoginPage lockup so the whole auth flow reads as
 * one product: the TM mark, a title, an optional subtitle, then the page's card.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-brand-700 font-display text-sm font-bold text-brass-300">
            TM
          </span>
          <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

/** The standard card surface used inside an AuthScreen. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-card">
      {children}
    </div>
  );
}
