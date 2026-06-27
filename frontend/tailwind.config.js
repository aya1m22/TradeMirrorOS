/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Three deliberate roles: display (technical), body, data (mono / ledger)
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Brand — "Pine": agriculture + trust
        brand: {
          50: "#eef4f1",
          100: "#d6e5dd",
          200: "#aecabb",
          300: "#7faa92",
          400: "#4f876b",
          500: "#2f6b4f",
          600: "#1f5c46",
          700: "#1a4a39",
          800: "#163b2e",
          900: "#112e24",
        },
        // Accent — "Brass": commodity / stamp, used with restraint
        brass: {
          300: "#ddc187",
          400: "#cba74f",
          500: "#b5862f",
          600: "#946a23",
          700: "#74521b",
        },
        // Neutral — warm, green-tinted "Ink"
        ink: {
          50: "#f6f7f5",
          100: "#eaece8",
          200: "#d6dad4",
          300: "#b4bbb4",
          400: "#8b948c",
          500: "#69736c",
          600: "#515a54",
          700: "#3f4742",
          800: "#2a302c",
          900: "#1b211e",
        },
        // Semantics derived from the palette, never stock blue/indigo
        success: "#2f8f5b",
        warning: "#c08a22",
        danger: "#b24a33",
        info: "#3f6ea3",
        // Token aliases backed by CSS variables (theme surface layering)
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        // Layered, ink-tinted, low opacity — base -> elevated -> floating
        card: "0 1px 2px rgba(27,33,30,0.04), 0 2px 6px rgba(27,33,30,0.05)",
        elevated:
          "0 2px 4px rgba(27,33,30,0.05), 0 8px 20px rgba(27,33,30,0.08)",
        floating:
          "0 8px 16px rgba(27,33,30,0.08), 0 20px 44px rgba(27,33,30,0.14)",
        "focus-brand": "0 0 0 3px rgba(47,107,79,0.28)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "scale-in": "scale-in 180ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
