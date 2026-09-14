// Fronts the static-asset Worker to enforce one canonical domain: any
// request to the retired blood.isayenko.net host is redirected permanently
// to the same path+query on paneloom.com; every other host (paneloom.com,
// the workers.dev preview) is served straight from ./dist via the ASSETS
// binding, unchanged.
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
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
