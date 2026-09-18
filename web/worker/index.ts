import { handleAuthRequest } from './auth'
import { handleDataRequest } from './githubData'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    const deps = { fetch: (input: string, init?: RequestInit) => fetch(input, init) }
    if (pathname === '/api/data') return handleDataRequest(request, env, deps)
    if (pathname.startsWith('/auth/')) return handleAuthRequest(request, env, deps)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
