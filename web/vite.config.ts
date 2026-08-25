import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dirname = import.meta.dirname

// Dev-only: serves web/dev-data/*.json at /dev-data/*.json during `npm run dev`.
// That folder sits outside Vite's publicDir, so nothing in it is ever copied
// into a production build — this plugin is the only way it's reachable, and
// it's a no-op during `vite build`.
function devDataPlugin() {
  return {
    name: 'dev-data-only',
    apply: 'serve' as const,
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/dev-data/')) return next()
        const filePath = resolve(dirname, 'dev-data', req.url.replace('/dev-data/', ''))
        if (!filePath.startsWith(resolve(dirname, 'dev-data')) || !existsSync(filePath)) return next()
        res.setHeader('Content-Type', 'application/json')
        res.end(readFileSync(filePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devDataPlugin()],
  base: './',
})
