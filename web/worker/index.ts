import { handleDataRequest } from './githubData'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/api/data') {
      return handleDataRequest(request, env, { fetch: (input, init) => fetch(input, init) })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
