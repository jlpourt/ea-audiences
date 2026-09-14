/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B10",
        surface: "#0D131D",
        "surface-raised": "#141D2B",
        "surface-border": "#1E2C42",
        "alert-red": "#FF4757",
        "ea-orange": "#FF7A00",
        "cyber-cyan": "#00F0FF",
        "neon-green": "#00FF88",
        "electric-purple": "#A855F7",
        "hud-gold": "#FFB800",
      },
      boxShadow: {
        "neon-cyan": "0 0 15px rgba(0, 240, 255, 0.4)",
        "neon-orange": "0 0 15px rgba(255, 122, 0, 0.4)",
        "neon-green": "0 0 15px rgba(0, 255, 136, 0.4)",
        "neon-purple": "0 0 15px rgba(168, 85, 247, 0.4)",
        "neon-red": "0 0 15px rgba(255, 71, 87, 0.4)",
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
        sans: ["var(--font-geist-sans)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
