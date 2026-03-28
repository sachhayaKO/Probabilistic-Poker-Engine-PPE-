/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: {
          950: '#000000',
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#222222',
        },
        red: {
          900: '#3b0000',
          700: '#7f1d1d',
          500: '#dc2626',
          400: '#ef4444',
          300: '#fca5a5',
        },
        accent: {
          red: '#dc2626',
          gold: '#ca8a04',
          white: '#f8fafc',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
        sans: ['"DM Sans"', 'Geist', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 12px rgba(220,38,38,0.25)',
        'glow-gold': '0 0 12px rgba(202,138,4,0.25)',
        'card': '0 0 0 1px rgba(220,38,38,0.08), 0 4px 24px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
}
