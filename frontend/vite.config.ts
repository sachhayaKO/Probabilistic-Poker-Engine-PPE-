import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set base to '/' for local dev or GitHub Pages root
// Change to '/Probabilistic-Poker-Engine-PPE-/' if deploying to GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/Probabilistic-Poker-Engine-PPE-/',
})
