/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0a0e1a",
          800: "#111827",
          700: "#1a2235",
          600: "#243044",
        },
        teal: {
          400: "#2dd4bf",
          500: "#14b8a6",
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4",
        },
        amber: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
