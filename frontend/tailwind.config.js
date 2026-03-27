/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0d1117',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        accent: {
          green: '#22c55e',
          amber: '#f59e0b',
          blue: '#3b82f6',
          red: '#ef4444',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
        sans: ['"DM Sans"', 'Geist', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(34,197,94,0.25)',
        'glow-blue': '0 0 12px rgba(59,130,246,0.25)',
        'glow-amber': '0 0 12px rgba(245,158,11,0.25)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
}
