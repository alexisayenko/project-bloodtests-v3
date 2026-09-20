# Testing and CI

## Where and how

Vitest suites live in `web/test/`, one file per module or concern; run with
`npm test` from `web/` (`vitest run`), `npm run coverage` for coverage, `npm
run lint` for eslint. `web/test/dataFiles.ts` loads the reference JSON for
the suites that validate it; fixtures under `web/test/fixtures/`.

## What the suites cover

- **Computed indices** — golden-masters ported from v2; `cft` and `biot`
  against ISSAM's published worked example and its live calculator's
  fixtures; the 280 g/mol pool solve; the band-less testosterone % indices;
  bioavailable testosterone and sex-dependent bands; Ly & Handelsman and
  Martin-Hopkins ([`computed-indices.md`](computed-indices.md#tests)).
- **Interchange** — upload parsing (the v3 envelope, and every non-v3 shape
  rejected), import-replace, export envelope, published JSON Schema
  conformance and generated-type drift (ajv and json-schema-to-typescript,
  devDependencies only), verbatim round trips (`verbatim-roundtrip.test.ts`: zip and cloud
  pull → push byte-identical on synthetic stored files, `lastUpdatedDate`
  set only on new or edited files), the per-report file writers
  (`report-files.test.ts`), the sync guards, old-shape stored sessions.
- **Diagnostic reports** — validation tiers, LOINC cross-check, the NLM
  lookup's unit selection (pure, no request made), the report-detail row
  helpers, the results context.
- **Units** — Latin / UCUM stages, dimension check, conversion, the
  property-gated U/IU fold in both directions and its refusal without an
  analyte.
- **Reference data** — every JSON under `web/public/data/` against its
  schema plus the consistency checks listed per file in
  [`reference-data.md`](reference-data.md).
- **Views and state** — share link and shared meta, explore model, markers,
  routing, scheduling and month keys, ui helpers, build stamp, format utils,
  lab pricing and the visit plan, medications (rows, bars, schema), backup
  archive and restore, the showcase generator, analyte sort, the Monitoring
  Panels status filter, cloud sync (the client in `cloud-sync.test.ts`, the session client and its sign-in marker in `cloud-session.test.ts`, the `useCloudSession` hook in `use-cloud-session.test.tsx`, the per-report file split, the Worker's GitHub data route with its session-cookie and allowlist checks, and the Worker's OAuth sign-in — state / nonce / `iss` / `aud` / `exp` / verified-email checks, the Apple client secret, cookie attributes and the CSRF guard — against stubbed `fetch` and Node's WebCrypto), `useHashRoute` (route read from the
  hash, `navigate`, browser back/forward through `popstate`, the
  blocked-route redirect, grid scroll restore), `useViewSettings` (defaults,
  persistence through every setter, share-link seeding without overriding a
  stored choice, `reload`) and `useAllResults` (flattening sessions with
  items already in memory, loading a session's items on demand, dropping a
  load superseded by a newer session list, the latest-by-LOINC and by-date
  indexes); both pathway views rendered in jsdom over synthetic results
  (`pathway-views.test.tsx`: zones, particles, badges and the
  illustrative-artwork note, grey dashes with no data, the date stepper, the
  SI/US switch, testosterone shares and the molar-mass select, the LDL-C
  badge's Martin-Hopkins fallback, a badge's reference range and Escape) and
  `pathwayShared.ts`'s pure helpers (`pathway-shared.test.ts`).

Not tested: anything needing real layout measurement — the pathway arrow and
association geometry (`HormonalPathways.geometry.ts`,
`LipidTransport.geometry.ts`: arrow paths, `fitBands`, pool sweeps and
callouts) has no dedicated unit test and is exercised only indirectly
through `pathway-views.test.tsx`'s rendering assertions — and the mobile
reveal (`TableScroller`, `usePullReveal`, `useHideOnScroll`, `useIsMobile`).

## CI

`.github/workflows/ci.yml`:

- `test` — lint → tests + coverage → build.
- `sonar` — parallel; the SonarCloud scan (CI-based, `SONAR_TOKEN` secret;
  Automatic Analysis is off) on a full-history checkout, re-running coverage
  for itself, so it reports on every push and PR without delaying the
  deploy. `sonar.coverage.exclusions` scopes the coverage metric to the
  testable logic, skipping the React view layer.
- `deploy` — no `needs:`, starts alongside both; only `npm run build`'s
  `tsc -b` can stop it ([`share-links-and-deploy.md`](share-links-and-deploy.md)).
- `lighthouse` — `needs: deploy`; gates Accessibility and Best Practices,
  reports Performance and SEO.

Dependabot: weekly npm (minor + patch grouped) and github-actions bumps.
