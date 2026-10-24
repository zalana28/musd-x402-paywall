/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08060b",
          900: "#0c0a10",
          850: "#100d14",
          800: "#151119",
          700: "#1d1722",
        },
        mezo: {
          orange: "#f7931a",
          amber: "#ffb454",
          gold: "#ffd9a0",
          ember: "#ff5f0a",
          mint: "#34d399",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        display: [
          "Space Grotesk",
          "Inter",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(247,147,26,0.45)",
        "glow-sm": "0 0 20px -6px rgba(247,147,26,0.5)",
        card: "0 8px 40px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "dash-flow": {
          to: { backgroundPosition: "28px 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.2s ease-out infinite",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "dash-flow": "dash-flow 0.7s linear infinite",
        float: "float 5s ease-in-out infinite",
        "spin-slow": "spin-slow 7s linear infinite",
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
