import { handleDataRequest } from './githubData'

// Enforces one canonical domain; every other host is served from ASSETS unchanged.
const RETIRED_HOST = 'blood.isayenko.net'
const CANONICAL_HOST = 'paneloom.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname === RETIRED_HOST) {
      url.protocol = 'https:'
      url.hostname = CANONICAL_HOST
      url.port = ''
      return Response.redirect(url.toString(), 301)
    }
    if (url.pathname === '/api/data') {
      return handleDataRequest(request, env, { fetch: (input, init) => fetch(input, init) })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
