import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The `demo` mode build (GitHub Pages) is fully static: base path matches the
// repo name and VITE_DEMO=1 (client/.env.demo) swaps the API for an
// in-browser mock. The normal build is unchanged (served by the Express API).
export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? '/ette-po-hub/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
}))
