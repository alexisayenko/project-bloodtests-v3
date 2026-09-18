# ADR-0027: The Worker owns Google / Apple sign-in; Supabase Auth is retired

Status: accepted · 2026-09-19 · supersedes the auth half of
[ADR-0019](adr-0019-self-hosted-supabase-replaces-firebase.md) and amends
[ADR-0026](adr-0026-github-backed-cloud-storage.md) (the identity provider
only; its GitHub-backed data store stands)

The storage-mode shape and the cutover model are unchanged
([ADR-0015](adr-0015-dedicated-server-storage-via-bearer-token.md),
[ADR-0018](adr-0018-firebase-storage-provisional.md), ADR-0019, ADR-0026): no
login stays local; signing in pulls-or-pushes once, signing out pushes then
clears; no ongoing two-way sync. What changes is who signs the user in. The
self-hosted Supabase Auth instance on perkunas (`api.paneloom.com`) is gone;
the app's own Cloudflare Worker performs Google and Apple OAuth itself and
issues a signed session cookie.

## Context

After ADR-0026 the Supabase instance did one job: turn a Google or Apple
sign-in into an access token the Worker checked with a shared JWT secret. That
was a Postgres, a GoTrue and a gateway on a home server, reachable through a
tunnel, kept running for a single OIDC exchange. The Worker already owns the
server role (ADR-0026) and already has the allowlist that decides who may
sync. Two OIDC providers, one allowlist and no database is a small amount of
code for the Worker to own.

## Decision

**The Worker runs the OAuth authorization-code flow for Google and Apple,
keeps no database, and authenticates `/api/data` with a signed session
cookie.**

- **Routes** (`web/worker/auth.ts`, routed from `web/worker/index.ts` before
  the static assets): `GET /auth/login/google|apple` redirects to the
  provider; `GET /auth/callback/google` and `POST /auth/callback/apple`
  finish the flow; `GET /auth/me` reports the session; `POST /auth/logout`
  clears it. The redirect URI is the request's own origin plus
  `/auth/callback/<provider>`.
- **The flow.** Google: code flow with PKCE (S256). Apple: code flow,
  `response_mode=form_post`, `scope=email`, a `nonce`. A random `state`,
  `nonce` and PKCE verifier live in a ten-minute HttpOnly cookie
  `paneloom_oauth`, HMAC-signed with `SESSION_SECRET` and `SameSite=None;
  Secure`, because Apple's callback is a cross-site POST that a `Lax` cookie
  would not survive.
- **The ID token** is read from the direct TLS response of the token
  endpoint, where signature verification is not required (OIDC Core
  3.1.3.7). The Worker still checks `iss`, `aud`, `exp`, that `nonce` matches
  the cookie, and that `email` is present and `email_verified`. The email,
  lowercased, must be in `ALLOWED_EMAILS` (unset denies everyone).
- **Apple's client secret** is an ES256 JWT built per login with WebCrypto
  from the `.p8` key, the Key ID, the Team ID and the Service ID.
- **The session** is the cookie `paneloom_session`: `HttpOnly; Secure;
  SameSite=Lax; Path=/`, 30 days, holding `{email, provider, iat, exp}` and
  an HMAC-SHA256 over it. `/api/data` verifies it on every request and
  re-checks the allowlist, so a removed email is cut off at once. `PUT` also
  needs the header `X-Paneloom: 1` and, when an `Origin` is present, the
  request's own origin; `POST /auth/logout` needs the header too.
- **The client** (`web/src/cloud/session.ts`, `web/src/cloud/sync.ts`,
  `web/src/hooks/useCloudSession.ts`) holds no token and no auth library:
  sign-in is a plain link to `/auth/login/<provider>`, the Account page learns
  the state from `GET /auth/me`, sign-out is `POST /auth/logout`. Because
  sign-in now ends in a full page load, the "just signed in" moment is a
  `sessionStorage` marker (valid ten minutes) set as the link is followed and
  consumed once after `/auth/me` succeeds; the cutover it triggers is unchanged.
- **Removed:** `@supabase/supabase-js`, `SUPABASE_JWT_SECRET`,
  `api.paneloom.com`, every `VITE_SUPABASE_*` variable.

## Alternatives considered

- **Keep Supabase Auth.** Works, but is a service to run for one exchange the
  Worker can do; the tunnel and the home server become a dependency of
  sign-in.
- **A managed identity service** (Auth0, Clerk, Firebase Auth). No ops, but a
  third party in the sign-in path and an account to pay for or lose, for
  something this small.
- **Google only.** Drops the Apple setup and its paid account, but Apple
  sign-in is already in the product.
- **Verify the ID token's signature against the provider's JWKS.** Not needed
  here: the token comes straight from the provider's token endpoint over TLS,
  which OIDC Core allows; a JWKS fetch would add a moving part for no gain.

## Consequences

- **One less service to run.** No Supabase, no perkunas tunnel, no shared JWT
  secret; the Worker plus the private repo are the whole backend.
- **Apple needs a paid developer account** and a Worker-side client secret
  (`.p8` key, Key ID, Team ID, Service ID). Google needs a Cloud project and
  an OAuth client. Both are one-off setups
  ([`account-and-sync.md#setup`](../account-and-sync.md#setup)).
- **Apple may return a private-relay address.** If the user hides their
  email, `email` is a relay address that is not their own; that address, not
  the real one, must be on `ALLOWED_EMAILS`, and it becomes the folder name
  in the data repo.
- **No refresh tokens.** The session is a fixed 30 days from sign-in; after
  that the user signs in again. There is no server-side revocation short of
  rotating `SESSION_SECRET` (which signs everyone out) or removing the email
  from `ALLOWED_EMAILS`.
- **Stateless sessions cannot be revoked individually.** Rotate
  `SESSION_SECRET` to revoke all of them; removing an email from
  `ALLOWED_EMAILS` blocks that account at once (`/auth/me` and `/api/data`
  answer `403`). `SESSION_SECRET` must be at least 32 characters, or the
  Worker treats it as unset.
- **Sign-in needs the Worker.** The Vite dev server has none; sign-in and
  sync need `wrangler dev` (or a proxy of `/auth` and `/api` to it), and the
  Account page shows "sign-in unavailable" when `/auth/me` is not the Worker.
- **The Worker holds more secrets** (session key, Google and Apple
  credentials) beside the GitHub token; none reaches the browser.

## What would force revisiting

- Sync opened beyond the allowlist: sessions, revocation and per-user
  isolation would need a store, which is a database again (see ADR-0026's
  revisit list).
- A sign-in provider the Worker cannot serve with a plain code flow.
- A need for sessions longer than 30 days or revocable one at a time.
