import { Component, type ReactNode } from "react";

/**
 * Top-level error boundary. Catches render-time crashes anywhere in the tree and
 * shows a recoverable fallback instead of a blank white screen in production.
 * Uses inline styles only, so it renders even if a styling failure caused the crash.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface for diagnostics; the boundary keeps the app from white-screening.
    console.error("[ErrorBoundary] Unhandled render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          fontFamily: "Inter, system-ui, sans-serif",
          background: "#faf9f6",
          color: "#1a1a1a",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: "#123d2e",
            color: "#c79a4b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          TM
        </div>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, color: "#555", margin: 0 }}>
          An unexpected error occurred. Reloading usually fixes it. If it persists, please contact support.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          style={{
            marginTop: "0.5rem",
            height: 40,
            padding: "0 1.25rem",
            borderRadius: 6,
            border: "none",
            background: "#123d2e",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
