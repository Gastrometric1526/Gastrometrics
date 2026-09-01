/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // DM Sans (rediseño visual, ver docs/79) — geométrica y cercana, reemplaza a
        // Inter. Fallback a Helvetica/Arial: cubre latín/latín-extendido (es/en/da/fr/pt);
        // zh sigue resolviendo al fallback del sistema, igual que antes.
        sans: ["var(--font-sans)", "Helvetica", "Arial", "sans-serif"],
      },
      colors: {
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
          7: "hsl(var(--chart-7))",
        },
        "canvas-alt": "hsl(var(--canvas-alt))",
        hairline: "hsl(var(--hairline))",
        "text-3": "hsl(var(--text-3))",
        "text-4": "hsl(var(--text-4))",
        success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
        warning: { DEFAULT: "hsl(var(--warning))", soft: "hsl(var(--warning-soft))" },
        info: { DEFAULT: "hsl(var(--info))", soft: "hsl(var(--info-soft))" },
        "danger-soft": "hsl(var(--danger-soft))",
        "primary-soft": "hsl(var(--primary-soft))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Única sombra del rediseño visual — solo para overlays (dialog, sheet,
        // dropdown, popover, context-menu, command). Nada más en la app usa sombra.
        overlay: "0 24px 52px -20px rgb(18 18 18 / 0.18)",
        // Toast: variante más suave de la misma sombra (ver docs/06 del paquete de diseño).
        toast: "0 14px 32px -14px rgb(18 18 18 / 0.16)",
      },
      zIndex: {
        9999: "9999",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
