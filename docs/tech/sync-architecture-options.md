# Sync architecture: the fuller option space

This is a reference document, not a decision record — nothing here is
accepted or rejected in the ADR sense. It exists because one session's
conversation about eventual cross-device sync / multi-user support
covered far more ground than what actually got decided
([ADR-0015](decisions/adr-0015-dedicated-server-storage-via-bearer-token.md)
→ [ADR-0017](decisions/adr-0017-supabase-storage-self-hosted-then-cloud.md)
→ [ADR-0018](decisions/adr-0018-firebase-storage-provisional.md)), and
some of that ground — most importantly, end-to-end encryption as an
alternative framing of the whole problem — isn't captured in any ADR.
Where a topic is already recorded there, this document points at it
rather than restating it. Read those three ADRs first; this document
assumes them.

## 1. The options compared, and why each was ruled out or deferred

The ADR chain above records the backend/auth choice actually made and
superseded twice (bespoke Bearer-token server → self-hosted-then-cloud
Supabase → Firebase, current and explicitly provisional). Before and
around that chain, a wider set of options was raised. The ones ADR-0015
already documents in full are only summarized here to keep one place as
the source of truth:

- **Full OAuth + a managed backend (e.g. Supabase) from day one.**
  Rejected: centralizes real health data in a third party for no real
  benefit at two-user scale. Full reasoning in ADR-0015's Context.
- **Cloudflare Access gating the Worker, reverse-proxying to a
  self-hosted origin.** Task-0025's original design. Rejected as more
  ops (a Tunnel, an Access policy, JWT verification code) than it saves
  for two people who could just hold a credential directly. Full
  reasoning in ADR-0015's Context.
- **A self-hosted custom OAuth2 authorization server** ("perkunas" for
  auth, Hetzner for data). Rejected as *more* infrastructure to secure
  than the Cloudflare option, and as the wrong tool on protocol grounds:
  OAuth2's machinery (authorization codes, redirect URIs, consent
  screens, scopes) exists to delegate access to *other client
  applications* — a problem this design doesn't have, with one
  first-party app and two known users. A lighter "Sign in with Google,
  perkunas mints its own session JWT" variant was judged sound but
  superseded once it was clear a login flow answers "who is this
  person," which two people each running their own browser don't need
  answered at all. Full reasoning in ADR-0015's Context.
- **Raw SSH credentials stored in the browser.** Rejected on two
  independently sufficient grounds: a browser has no raw TCP/SSH
  capability, so an HTTP API in front of the server is unavoidable
  regardless of this choice; and even granting that away, an SSH
  private key is a categorically larger secret to expose than a scoped
  token — full shell and every file, versus one narrow, revocable
  capability. Full reasoning in ADR-0015's Context.
- **The scoped-Bearer-token custom Node service.** ADR-0015's own
  decision — no OAuth, no login, a pasted token. Superseded by
  ADR-0017.
- **Self-hosted-then-cloud Supabase.** ADR-0017's decision — self-host
  on perkunas first (removes the "third-party" objection while the
  feature is a two-person POC), migrate to managed Supabase Cloud once
  there are real users. Superseded by ADR-0018 before either phase was
  built, on setup-speed and ops-burden grounds, plus managed Supabase's
  free tier pausing an inactive project — a real risk for this app's
  irregular usage pattern.
- **Firebase.** ADR-0018's current, explicitly provisional decision —
  Firebase Auth (Google Sign-In) + Firestore. Chosen for setup speed and
  no inactivity pause, not because it won an evaluation on long-term
  merits.

One more thread was raised and deliberately left open rather than
decided either way: whether `project-travel` and `project-wardrobe`
(currently on managed Supabase Cloud, per ADR-0017's Context) should
eventually move onto whatever backend this app settles on. That is an
explicitly separate, undecided question belonging to those repos, not
this one — noted here only so it isn't lost.

## 2. End-to-end encryption — an alternative that reframes the question

Every option above, including the one actually adopted, shares one
assumption: the backend can read the plaintext data, and the question
being asked is "do we trust it." A materially different option was
discussed seriously enough to warrant its own treatment: encrypt the
data client-side before it ever reaches a backend, so that whichever
backend is chosen only ever holds ciphertext it cannot read.

### The model: how Apple actually syncs Health data

The usual mental shorthand for Apple Health — "it stays on the device"
— is not quite what happens, and the actual mechanism is the useful
model here. Health data does sync across a person's devices via iCloud,
but end-to-end encrypted: Apple's servers hold only ciphertext. The key
lives in each device's Secure Enclave, unlocked by the device passcode
or biometric, and never leaves that hardware in readable form. Adding a
new device propagates the key to it via a trusted-device approval
handshake — an existing device explicitly vouches for the new one —
that also never transits Apple's servers in a form Apple could read.

The point worth taking from this: Apple does not skip key management.
It hides key management inside hardware (the Secure Enclave) and an
existing-device trust relationship that most web apps simply don't have
access to. Any web-app version of this idea inherits the key-management
problem without inheriting Apple's hardware to solve it with.

### Why this would matter for this app

If the data is encrypted client-side before it reaches storage, the
choice of backend — Firebase, self-hosted Supabase, anything else —
stops being a health-data-privacy question at all, because none of
those backends could read the actual content regardless of which one is
picked. The backend choice becomes a pure dev-speed / cost / ops
question, decoupled from the privacy stakes that drove most of the
Context sections in ADR-0015 through ADR-0018. That is a genuinely
different framing from everything compared in section 1 above, all of
which reasoned about trust in a backend that reads plaintext.

### The real cost: key management

Encryption is not free — it introduces exactly the problem Apple's
hardware exists to hide. The key cannot be derivable from anything the
backend or auth provider (Firebase, Google) can also derive, or the
scheme isn't actually zero-knowledge — an auth-provider-derived key
would just move the trust assumption, not remove it. For a web app,
with no OS-level Secure Enclave and no device-to-device trust prompts
to lean on, two realistic options were discussed:

- **A user-set passphrase, separate from login.** Real typing friction
  on every new device, but simple and robust. A forgotten passphrase
  means genuinely unrecoverable data by design — the same tradeoff
  Apple's own Advanced Data Protection accepts when a user turns it on.
- **A device-pairing flow.** An already-authenticated device shows a QR
  code; a new device scans it and receives the key directly, no typing.
  Closer to Apple's actual UX for adding an Nth device — but it still
  needs an existing trusted device to onboard from (no help for the
  very first device, or after losing every device at once), and it
  still needs its own answer for total-device-loss recovery — in
  practice, a saved recovery code, same as Apple's fallback.

### Status: discussed, not decided

This was a serious alternative, not a rejected one. Alex chose, for
this round, the simpler and faster near-term path described in section
3 below rather than building end-to-end encryption now. Nothing here
should be read as this option having lost an evaluation — it remains
open for a future session to pick up, particularly if the health-data
centralization tradeoff that ADR-0018 explicitly deferred (see its
Consequences and "What would force revisiting") comes back into focus.

## 3. What's actually being built right now, for contrast

Distinct from all of the above, and decided after this whole
discussion: Alex asked for a deliberately narrower, faster near-term
plan rather than any of the fuller designs in sections 1–2.

- **Centralized storage**, Firebase Firestore, per ADR-0018.
- **One document per profile** (Alex, his mother) rather than per-user
  accounts.
- **A simple in-app profile picker** to switch which profile's data is
  being read and written.
- **Explicitly not** Google Sign-In or any real per-person
  authentication — the profile picker is a UI convenience, not an auth
  boundary.
- **Explicitly not** end-to-end encrypted — this is the plaintext-in-
  a-trusted-backend model section 2 reframes, not the zero-knowledge
  one.
- **Explicitly drops** ADR-0015's local-storage-stays-default /
  opt-in-server-mode toggle. There is no "local" vs "dedicated server"
  choice in this near-term plan — storage is simply centralized.

This is a narrower scope than any of ADR-0015 through ADR-0018 actually
specify, and it has not yet been written up as its own ADR or task
ticket — this document is not that record. When the implementation
work is scoped, it belongs in a new ADR (recording the profile-picker
model as a further departure from ADR-0015's shape) or a task ticket
under `docs/tasks/`, whichever this project's normal process reaches
for first. Until then, this paragraph is the only pointer to it.
