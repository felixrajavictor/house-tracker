import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/ — CI sets BASE_PATH; local dev stays at /
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // host: true lets a phone on the same Wi-Fi open the dev server
  server: { host: true, port: 5173 },
})
