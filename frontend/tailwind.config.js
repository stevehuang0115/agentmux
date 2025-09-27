/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#2a73ea",
        "background-dark": "#111721",
        "surface-dark": "#1a222c",
        "text-primary-dark": "#f6f7f8",
        "text-secondary-dark": "#9ab0d9",
        "border-dark": "#313a48",
      },
      fontFamily: {
        "display": ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        "mono": ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "1rem",
        "xl": "1.5rem"
      },
    },
  },
  plugins: [],
}