# Lab data import — direct from labs and portals

Research note, 2026-09-18. Not a decision: it maps what a direct import of
lab results (instead of the chatbot-prompt path) could legally and technically
rest on, region by region, and where it would strain the product's principles.
Leads came from an AI-search conversation; every claim kept here was checked
against a primary source, and what could not be is marked **unverified**.

## Purpose

Every report enters through a chatbot prompt from a PDF, then hand-correction
([`diagnostic-reports.md`](diagnostic-reports.md)) — the slowest, most
error-prone step, and the one limiting the app to people willing to do it. A
direct import would fetch the lab's own LOINC-coded record and feed it through
the same `parseUpload` path. The envelope is already FHIR-shaped
([ADR-0002](decisions/adr-0002-borrow-fhir-shapes-not-fhir.md),
[ADR-0008](decisions/adr-0008-fhir-shaped-envelope-not-fhir.md)), so the
mapping is a flattening, not a redesign; the boundary in
[ADR-0023](decisions/adr-0023-product-purpose-and-clinical-boundary.md) does
not move — the app records and compares, and owns no database (its one Worker route is the sync proxy of ADR-0026).

## Legal basis by region

### United States

- **HIPAA right of access, 45 CFR 164.524.** An individual may inspect and
  obtain a copy of PHI in a designated record set; the covered entity has 30
  days, one 30-day extension; the copy comes "in the form and format requested
  ... if it is readily producible" and, on written request, goes to a person
  the individual designates (c)(3)(ii); fees are cost-based (c)(4). Verified.
- **Labs are covered.** 42 CFR 493.1291(l), amended 2014 (79 FR 7316), lets a
  CLIA laboratory give patients and their designees completed test reports
  directly. Verified.
- **Information blocking, 45 CFR Part 171.** "Actor" includes a health care
  provider as defined in 42 U.S.C. 300jj, and that list names "a laboratory"
  explicitly. Since 2022-10-06 the rule covers all EHI; certified EHRs must
  expose a FHIR R4 / US Core / SMART API (§170.315(g)(10), from 2022-12-31).
  Verified. The rule binds *actors*, not app developers.
- **CMS Patient Access API (CMS-9115-F).** Payers only — MA, Medicaid, CHIP,
  FFE QHP issuers, FHIR R4 from 2021-07-01. It obliges no lab and no provider.
  Verified.
- **In practice.** Fasten Health's complaint IB-2820 records Labcorp refusing
  a third-party app FHIR access while its own app and Apple Health use the same
  patient-access API; no regulator outcome recorded. Verified as a complaint,
  not a finding. Quest's public FHIR guides are for its Quanum EHR — a
  patient-app endpoint is **unverified**.
- **What an individual developer needs.** No HIPAA status — an app the person
  runs for themselves is neither covered entity nor business associate (HHS
  guidance on individual-chosen apps not re-read — **unverified**) — but a
  client registration per EHR vendor: Epic on FHIR gives a free account and
  client IDs, and its directory lists ~1,278 R4 base URLs as a downloadable
  Bundle. Whether an app works at every Epic organization without that
  organization enabling it is **unverified** (Epic's docs have Community
  Members "download" the app record).

### European Union

- **GDPR Art. 15** — a copy of the personal data, in "a commonly used
  electronic form" when asked electronically; **Art. 12(3)** — one month,
  extendable by two; **Art. 12(5)** — free. Verified. This is the right that
  applies to every lab, public or private.
- **GDPR Art. 20** — "structured, commonly used and machine-readable format",
  direct transmission "where technically feasible" — but only where processing
  rests on consent or contract *and* is automated. A private lab contract
  qualifies; a public-health lawful basis does not. Verified from the text. It
  gives a file, not an API.
- **EHDS, Regulation (EU) 2025/327.** Published 2025-03-05, in force
  2025-03-26; general application March 2027; patient summaries and
  ePrescriptions March 2029; **laboratory results, imaging and discharge
  reports March 2031**, in the European EHR exchange format (EEHRxF), with
  natural persons getting free electronic access and download. Dates verified
  (Parliament, Commission); article numbers (3, 14, 15, 23) **unverified** —
  EUR-Lex refused every fetch.
- **MyHealth@EU** today exchanges ePrescription/eDispensation and Patient
  Summaries between National Contact Points; lab results are a later phase.
  Verified. It is a state-to-state network, not a citizen API.
- **xShare "Yellow Button"** is a Horizon Europe project piloting one-click
  EEHRxF export at eight sites — a project, not an EHDS obligation as the AI
  answer had it. Verified as a project. The technical spec to target is its
  [IPS+ implementation guide](https://build.fhir.org/ig/hl7-eu/xshare-ips-plus/technical.html)
  (HL7 Europe, FHIR R4.0.1): the International Patient Summary extended with
  routine laboratory and microbiology data items, harmonized value sets and
  FHIR→CDISC mappings, proposed as the EEHRxF representation the Yellow Button
  exports — still a CI build (0.2.0 qa-preview), not a released version.
- **National portals.** Cyprus: the GeSY Beneficiary Portal shows patient
  summary, prescriptions and medical history (gesy.org.cy); eHealth4U, the
  FHIR R4 national EHR with a lab-results section, is a *prototype* (PMC,
  2026); any machine-readable export is **unverified**. Other portals (Mon
  espace santé, Sundhed.dk, Kanta…) not checked.

### Ukraine

- **ЕСОЗ (eHealth).** A central database whose API is for accredited medical
  information systems (МІС) only; its documentation index lists Medical Events,
  Service Requests, ePrescription and Composition, no FHIR, no third-party
  developer API. Verified (index page). Lab results go in as a *Diagnostic
  Report* event carrying *Observation* records with an ЕСОЗ code — snippets
  only (MOZ guidance, МІС vendor pages); the ЕСОЗ page body did not load.
  Patients see them in a МІС cabinet (Helsi) or Дія, on screen; no export
  found — **unverified** beyond snippets.
- **Private labs** (Synevo, Esculab, Medis, NeoGenesis) publish results in a
  personal cabinet and as PDF; Synevo names a B2B API via sales — snippet,
  **unverified**. No patient-facing API found, so the chatbot-from-PDF path
  stays the only route here. Ukraine's own access right (Law 2297-VI) not
  researched.

## Technologies

### SMART App Launch for a browser-only app

SMART App Launch v2.2.0 (STU 2.2, FHIR R4), verified: standalone launch,
discovery at `[base]/.well-known/smart-configuration`, authorization request
with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`
(≥122 bits), `aud=[base]`, `code_challenge` + `code_challenge_method=S256`;
PKCE is mandatory for every SMART app, and a "public client" — an in-browser
JS app that cannot keep a secret — sends `client_id` and `code_verifier` to the
token endpoint with no `client_secret`. Token response: `access_token`,
`expires_in`, `scope`, optional `refresh_token`, `patient`. Scopes:
`patient/Observation.rs`, `patient/DiagnosticReport.rs` (v1 `.read` still
accepted), narrowable to
`patient/Observation.rs?category=http://terminology.hl7.org/CodeSystem/observation-category|laboratory`,
plus `launch/patient`, `openid fhirUser`, `offline_access` for a refresh token.

The Worker's own OAuth (`web/worker/auth.ts`, ADR-0027) already runs this
shape for Google and Apple — a code flow with PKCE, return through a
query-string callback because the hash belongs to the router — so the same
handling extends to a second issuer. Bulk Data (`$export`) does
not apply: it authorizes with SMART Backend Services (JWT client assertion,
`system/` scopes, no user), which the spec itself says is not for user-consent
apps. Verified. `Patient/[id]/$everything` exists in R4 (searchset Bundle,
`start`/`end`/`_since`/`_type`) but whether patient-facing servers expose it is
**unverified**.

### FHIR R4 queries for lab data

```
GET [base]/Observation?patient=[id]&category=laboratory&date=ge2016-01-01&_count=200
GET [base]/DiagnosticReport?patient=[id]&category=LAB&_include=DiagnosticReport:result
```

US Core's Laboratory Result profile requires servers to answer
patient+category, patient+code and patient+category+date, fixes
`category=laboratory`, binds `code` to LOINC, and requires
`valueQuantity.system` = UCUM and `code.text` = the test name. Paging is
`Bundle.link[rel=next]`. Verified.

### Indirect sources

- **Apple Health Records** aggregates providers' FHIR into HealthKit; a
  third-party iOS app reads `HKClinicalRecord` of type `labResultRecord`, each
  an `HKFHIRResource` with `fhirVersion` R4 or DSTU2 and the JSON in `.data`;
  entitlement `com.apple.developer.healthkit.access` with `health-records`;
  on-device. Available in the US, UK and Canada (Apple newsroom 2020, support
  snippet). Verified. Relevant to the mobile app only.
- **Android Health Connect Medical Records** stores FHIR R4 (4.0.1) and R4B
  (4.3.0); `Observation` with category `laboratory` maps to
  `MEDICAL_RESOURCE_TYPE_LABORATORY_RESULTS`, read under
  `READ_MEDICAL_DATA_LABORATORY_RESULTS`; a reading app cannot fetch from
  providers — a source app must have written it. Experimental
  (`@ExperimentalPersonalHealthRecordApi`, Android 16 SDK). Verified.

### LOINC terminology

`https://fhir.loinc.org` (`CodeSystem/$lookup?system=http://loinc.org&code=…`)
needs a free loinc.org account and basic auth — unusable from a browser without
shipping credentials. The app already has 164 catalog entries offline
(`analyses.json`) and the opt-in NLM name lookup (`loincNlm.ts`); a fetched
Observation carries its LOINC, so no new terminology call is needed.

## Mapping to the existing envelope

| FHIR R4 | Envelope | Care |
|---|---|---|
| `DiagnosticReport.performer` → `Organization.name` | `lab` | lab as named by the server, not as printed |
| `Observation.effectiveDateTime` / `Specimen.collection.collectedDateTime` | `collectedAt` | prefer Specimen when referenced |
| `DiagnosticReport.issued` | `issuedAt` | |
| `DiagnosticReport.identifier[]` | `identifiers.accession` / `order` | feeds the session id |
| `Specimen.type` (SNOMED) | `specimen.material` | needs a small SNOMED → word map |
| `code.coding[system=loinc.org].code` | `loinc` | none → `""`, then the offline resolver |
| `code.text` (else the coding `display`) | `rawName` | `display` is LOINC's name, not the lab's — flag |
| `valueQuantity.value` / `.comparator` | `value` / `comparator` | |
| `valueString`, `valueCodeableConcept.text` | `rawValue` only | text-only result |
| `valueQuantity.unit` | `rawUnit` | the human-readable unit — nearest to "printed" |
| `valueQuantity.code` where `system` is UCUM | `unit` | only then; otherwise fold `rawUnit` as today |
| `referenceRange[].low/high.value`, `type.text`, `appliesTo`, `age`, `text` | `referenceRanges[]` | same shape by design |
| `interpretation[0].coding.code` | `interpretation` | v3 ObservationInterpretation, same codes |
| `method.text` | `method` | |
| `status` | — | keep `final`/`amended`/`corrected`, drop the rest |
| `hasMember` parents, `Patient` | — | flatten; never store the person |

Where ADR-0003 needs care: a FHIR server hands over what the lab's *system*
stored, not what it *printed* — `unit` and `code` may differ in spelling or,
on a converting server, in scale. Convert neither; store the pair as received,
run the existing dimension check, and keep `presentedForm` (the lab's PDF) as
the cross-check where offered. A `rawValue` rebuilt from `comparator` +
`value` is derived, not printed, and should say so.

## Constraints from the product principles

- **No server.** A public client: no secret, no proxy. The access token lives
  in memory (sessionStorage at most), never in localStorage beside the results;
  a refresh token, if issued, is the one thing to encrypt or decline.
  `redirect_uri` is `https://paneloom.com/`, registered per vendor. The FHIR
  server must send CORS headers for a browser — whether g(10) requires that
  is **unverified**.
- **What leaves the device.** The OAuth redirect and the FHIR reads, both to
  the lab; nothing to a third party. The privacy paragraph in
  [`README.md`](README.md#data-privacy-in-one-paragraph) gains a third opt-in
  exception beside the NLM lookup and the GitHub-backed sync.
- **Stored as printed.** Nothing converted on the way in; the import writes a
  `3.x` envelope through `parseUpload` and nothing else, so export and share
  links are untouched.
- **No identity in the file.** `Patient` is read for the context id only;
  `Patient.gender` may *offer* to seed Database details, never write it.

## Open questions

- Which US vendor to register with first (Epic has the public directory), and
  whether one registration reaches patients at every organization.
- Whether any lab the family uses exposes more than a PDF — one Art. 15/20
  email to Synevo (also present across the EU) would settle it.
- Where a fetched report's provenance goes: `identifiers` could carry the FHIR
  `id`, or the schema gains a minor.
- Refresh tokens and re-authorization cadence for a public client.

## Suggested next step

A spike: register a patient-facing app on Epic on FHIR, run the standalone
PKCE flow from a local build against the open.epic sandbox, fetch
`Observation?category=laboratory`, map it into a `3.x` envelope with the table
above, and diff against a chatbot-built envelope for the same panel —
`rawName`/`rawUnit` are where the two will disagree.

## Sources

Retrieved 2026-09-18. "Snippet" means read through a search result, not the
page itself.

- https://hl7.org/fhir/R4/observation.html — `code` bound to LOINC (example
  strength), value[x], Quantity fields, referenceRange sub-fields.
- https://hl7.org/fhir/R4/diagnosticreport.html — `result` as
  Reference(Observation), `issued`, `performer`, `presentedForm`, search params.
- https://hl7.org/fhir/R4/search.html — `_include` syntax, date prefixes,
  `_count` and `Bundle.link next`.
- https://hl7.org/fhir/R4/patient-operation-everything.html — `$everything`
  parameters and paging note.
- https://hl7.org/fhir/smart-app-launch/app-launch.html — v2.2.0 standalone
  flow, PKCE mandatory, public-client token request without secret.
- https://hl7.org/fhir/smart-app-launch/scopes-and-launch-context.html — v2
  `.rs` scopes, search-parameter-constrained scopes, v1 compatibility.
- https://hl7.org/fhir/smart-app-launch/backend-services.html — Backend
  Services is system-to-system, the authorization Bulk Data uses.
- https://www.hl7.org/fhir/us/core/StructureDefinition-us-core-observation-lab.html
  — US Core v9 lab profile: UCUM required, `code.text`, search requirements.
- https://www.law.cornell.edu/cfr/text/45/164.524 — HIPAA right of access:
  30 days, form and format, designated recipient, fees.
- https://www.law.cornell.edu/cfr/text/42/493.1291 — CLIA labs give patients
  completed reports directly (2014 amendment).
- https://www.law.cornell.edu/cfr/text/45/171.102 — information-blocking
  "actor" and "health care provider" via 42 U.S.C. 300jj.
- https://www.law.cornell.edu/uscode/text/42/300jj — the provider list names
  "a laboratory".
- https://www.healthit.gov/topic/information-blocking — 2021-04-05 /
  2022-10-06 dates, g(10) FHIR R4 + US Core + SMART from 2022-12-31.
- https://www.cms.gov/priorities/key-initiatives/burden-reduction/interoperability/policies-and-regulations/cms-interoperability-and-patient-access-final-rule-cms-9115-f
  — Patient Access API is a payer obligation, 2021-07-01.
- https://github.com/fastenhealth/information-blocking-complaints/blob/main/IB-2820-labcorp.md
  — Labcorp's refusal to a third-party app, as complained.
- https://fhir.epic.com/Documentation?docId=patientfacingfhirapps — free
  account, client IDs, "Patients" app type, Community Members download the
  app record.
- https://open.epic.com/MyApps/Endpoints — ~1,278 R4 endpoints as a
  downloadable Brands Bundle.
- https://gdpr-info.eu/art-15-gdpr/, https://gdpr-info.eu/art-20-gdpr/,
  https://gdpr-info.eu/art-12-gdpr/ — access copy in electronic form;
  portability conditions and "technically feasible"; one month, free.
- https://www.europarl.europa.eu/legislative-train/theme-promoting-our-european-way-of-life/file-european-health-data-space
  — EHDS 2025/327 dates: 2025-03-26 in force; 2027, 2029, 2031 phases.
- https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en
  — Commission's own phase list: lab results March 2031.
- https://health.ec.europa.eu/ehealth-digital-health-and-care/electronic-cross-border-health-services_en
  — MyHealth@EU: ePrescription and Patient Summary now, lab results later.
- https://xshare-project.eu/the-xshare-button/ (snippet) — Yellow Button is
  a Horizon Europe project.
- https://build.fhir.org/ig/hl7-eu/xshare-ips-plus/technical.html — IPS+ IG
  (HL7 Europe, FHIR R4.0.1): IPS plus routine lab and microbiology items as the
  Yellow Button's EEHRxF payload; CI build 0.2.0 qa-preview, changes regularly.
- https://pmc.ncbi.nlm.nih.gov/articles/PMC13133457/ — eHealth4U is a FHIR R4
  prototype with a lab-results section (2026).
- https://www.gesy.org.cy/en-us/home-en (snippet) — Beneficiary Portal shows
  patient summary, prescriptions, medical history.
- https://e-health-ua.atlassian.net/wiki/spaces/EH/overview — ЕСОЗ API is for
  МІС; record types listed; no FHIR, no public developer API.
- https://moz.gov.ua/uk/elektronni-medichni-zapisi-v-esoz (snippet) — lab
  results as Diagnostic Report + Observation records.
- https://www.synevo.ua/en/personal-cabinet/my-results,
  https://esculab.com/result-tests (snippets) — personal cabinets, PDF; B2B
  API by sales request.
- https://developer.apple.com/documentation/healthkit/accessing-health-records
  — `HKClinicalRecord`, `labResultRecord`, `HKFHIRResource` R4/DSTU2,
  entitlement, on-device.
- https://www.apple.com/newsroom/2020/10/health-records-on-iphone-available-today-in-the-uk-and-canada/
  (snippet) — US, UK, Canada.
- https://developer.android.com/health-and-fitness/health-connect/medical-records
  and `…/medical-records/data-format` — R4/R4B, laboratory mapping,
  permissions, experimental, source-app-written.
- https://loinc.org/fhir/ (snippet) — `fhir.loinc.org`, free account and
  password required.
