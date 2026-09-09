import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const dirname = import.meta.dirname

// CI passes the commit, so the build needs no git checkout metadata; locally we
// ask git; if both fail the stamp says "dev" rather than failing the build.
function buildCommit(): string {
  const fromCi = process.env.GITHUB_SHA
  if (fromCi) return fromCi.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'dev'
  } catch {
    return 'dev'
  }
}

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
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_TIME__: JSON.stringify(process.env.BUILD_TIME ?? new Date().toISOString()),
  },
})
