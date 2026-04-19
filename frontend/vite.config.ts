import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/Probabilistic-Poker-Engine-PPE-/' : '/',
  server: {
    host: '0.0.0.0',
    proxy: {
      '/start_game': 'http://localhost:8000',
      '/action': 'http://localhost:8000',
      '/game_state': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
  optimizeDeps: {
    holdUntilCrawlEnd: false,
  },
})
