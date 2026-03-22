/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      center: true,
      padding: "1rem",
      screens: {
        xl: "1120px",
      },
    },
    extend: {
      colors: {
        cream: {
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        berry: {
          50:  "#FFF1F3",
          100: "#FFD6DC",
          200: "#FFB3BE",
          300: "#FF8099",
          400: "#F45F7A",
          500: "#E8142E",
          600: "#C41230",
          700: "#A50E27",
          800: "#8B0A1E",
          900: "#5C0516",
        },
        cocoa: {
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      boxShadow: {
        card:      "0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05)",
        "card-md": "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        glow:      "0 8px 24px rgba(196,18,48,0.28)",
        "glow-sm": "0 4px 14px rgba(196,18,48,0.22)",
      },
      backgroundImage: {
        "cake-glow": "none",
        sprinkles:   "none",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 400ms ease-out both",
        "fade-in": "fade-in 300ms ease-out both",
        float:     "float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
