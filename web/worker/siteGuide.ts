import { CHATBOT_PROMPT } from '../src/data/chatbotPrompt';
import { SCHEMA_VERSION } from '../src/data/envelopeSchema';
import { SITE_GUIDE_PATH } from '../src/data/sitePrompt';
import monitoringPanels from '../public/data/monitoring-panels.json';

const SITE = 'https://paneloom.com';
const PANEL_NAMES = monitoringPanels.map((p) => p.name);

export const SITE_GUIDE = `# Paneloom — guide for AI assistants

You are reading this because a user pasted a prompt asking you to learn how ${SITE} works and then help them use it. This page is written for you, the assistant. Read it fully, then guide the user one step at a time in plain language. Every label in quotes below is the exact English text of a button, tab or heading in the app, so you can tell the user precisely what to click.

Canonical address of this guide: ${SITE}${SITE_GUIDE_PATH} (plain text, Markdown formatting).

## 1. What Paneloom is

- A free, browser-only tracker for blood-test (lab) results. The user loads lab reports as JSON files and Paneloom keeps a long-term history across different laboratories, countries, languages and units.
- Every result is keyed to a LOINC code (the international code for a lab test), so the same test from different labs lines up on one timeline.
- Results are grouped into Monitoring Panels by condition or organ system, and the app computes cited clinical indices (for example HOMA-IR, AIP, calculated free testosterone, LDL-C estimates) from the user's values.
- It is a personal, longitudinal record — not a diagnostic tool. It shows exactly what the lab printed; converted or derived numbers are computed for display only and never replace the printed value.
- It reads no PDFs and no photos itself. The usual way in is: a chatbot (you) reads the user's lab report and produces a JSON file, and the user uploads that file.

## 2. How to help the user

1. First ask what they want: try a demo, add their own lab reports, look at results they already loaded, or restore a backup. Then follow the matching path in section 4.
2. Give one or two steps at a time, name the exact button, and wait for them to confirm before moving on.
3. If they want to add lab reports, you can do the extraction yourself: follow the extraction instructions in section 12 (the same text as the app's "Copy the prompt" button) and give them a .json file to upload.
4. Never invent a test, value, unit, reference range or LOINC code. If something on a report is unclear, ask the user.
5. Do not diagnose. You may explain what a marker or index generally means and that a value is outside the printed range, but send medical decisions to the user's doctor.
6. You cannot operate the site for the user: the app runs in their browser and stores data there. You only instruct; they click.

## 3. Key concepts

- **Diagnostic Report** — one lab report: one laboratory, one blood draw (date/time), and its list of observations.
- **Observation** — one test result on a report: the printed test name ("rawName"), the value, the unit, and the printed reference range.
- **LOINC code** — a code like "2093-3" identifying the test. Paneloom matches and groups results only by LOINC. An observation with no LOINC is kept but does not appear in panels or All Observations.
- **Monitoring Panel** — a condition- or organ-oriented group of observations and indices. Current panels: ${PANEL_NAMES.join(', ')}.
- **Computed index** — a number derived from several results (HOMA-IR, TyG index, AIP, LDL-C by Friedewald / Martin-Hopkins / Sampson, non-HDL cholesterol, free androgen index, calculated free testosterone, De Ritis ratio, transferrin saturation and others). Each carries a cited formula; an index outside its validity range shows "–" instead of a number. Sex-dependent indices need the user's sex to be set (section 5.12).
- **Status colours** — green: within range; amber/red: outside range; grey: no range or no status available.
- **Envelope** — the JSON file format Paneloom imports (schema "${SCHEMA_VERSION}"), described in section 7.
- **Scheduled visit** — a planned future blood draw: a list of tests the user wants, a target month, and an optional chosen laboratory.

## 4. Quick-start paths

**A. Just look around (demo data).** Open ${SITE}/#profile ("Get Started" in the menu) and press "Generate Test Data". It adds 16 sample reports from five labs plus 5 sample medications (merged with anything already loaded) and opens the All Observations Trends tab. The sample data can be removed later with "Clear all data" on the Account page.

**B. Add the user's own lab reports (most common).**
1. Get the report into JSON: either you extract it now (section 12), or the user opens ${SITE}/#reports, presses "Copy" under "Copy the prompt" on the "Add a report" card, and pastes that prompt into a chatbot together with the PDF or photo.
2. The chatbot returns a .json file. The user saves it to their device.
3. On ${SITE}/#reports, under step 3 "Add the JSON", press "Add" and choose the file. A green "✓ Added N reports" confirms it. Adding merges with reports already loaded.
4. Check the report list: a red dot means errors to fix, amber means warnings, green means clean (section 5.2).
5. Open "Monitoring Panels" or "All Observations" to see the results.

**C. The user already has a Paneloom JSON file.** On "Get Started" press "Import JSON". Note: this REPLACES all reports currently loaded. To add without replacing, use "Add" on the Diagnostic Reports page instead.

**D. Restore a full backup (.zip).** On ${SITE}/#account press "Import all data" and choose the zip made earlier by "Export all data". It replaces everything stored in this browser.

## 5. Every feature, step by step

The app is one page; each section has its own address after "#". The menu (left sidebar on desktop, top bar on phones) lists, in order: Get Started, Diagnostic Reports, All Observations, Monitoring Panels, Hormonal Pathways, Lipid Transport, Scheduled Visits, Medications, Reference Book, Account.

### 5.1 Get Started — ${SITE}/#profile
- A short description of the app, then "Generate Test Data" (demo), "Import JSON" (replaces all loaded reports with one JSON file) and "Go to Diagnostic Reports".
- A "New here? Ask your chatbot" card with a ready-to-copy prompt that points a chatbot at this guide.

### 5.2 Diagnostic Reports — ${SITE}/#reports
- A "Reports" table listing every loaded report by draw date and lab, with a status dot per report. Click a row to open it.
- The "Add a report" card, three steps: 1 "Copy the prompt" ("Copy" copies the extraction prompt; "View prompt" shows it), 2 "Paste into a chatbot", 3 "Add the JSON" ("Add" uploads a file and merges it).
- "Clear local DB" removes all loaded reports from this browser after a confirmation (medications, visits and settings stay).
- Validation, two tiers:
  - **Errors** (red): an observation missing its printed name, missing its value, or carrying a code that is not LOINC-shaped (digits, hyphen, one check digit). While any error exists, Monitoring Panels, All Observations, Hormonal Pathways and Lipid Transport are disabled and redirect to Diagnostic Reports. Fix the rows (5.3) or remove and re-add a corrected file.
  - **Warnings** (amber), informational only: empty LOINC (row will not appear in panels), missing unit, missing reference range, a unit that contradicts the code (e.g. a mass unit on a molar code), a unit that is not recognised. Some warnings faithfully reflect the report (for example MCHC printed in "%", or absolute differential counts printed without a range) and can be left as they are.

### 5.3 A single report — ${SITE}/#reports/<file>
- Shows the report's observations: printed name, LOINC, value, unit, reference range, with any validation messages.
- The LOINC, value and unit cells are editable in place; press "Save" to keep the edit or "Cancel" to discard it. Edits are stored immediately in the browser after Save.
- "Cross-check LOINCs" derives each row's LOINC offline from the printed name and unit (works for English, Greek, Russian and Ukrainian printouts). Confident fixes are filled in automatically ("✓ N codes filled automatically — review and Save"); rows it cannot settle get clickable suggestion chips. Nothing is stored until "Save".
- "Check online (NLM)" — offered only for rows the offline pass could not resolve — sends the test NAMES (never values) to the US National Library of Medicine's lookup service (clinicaltables.nlm.nih.gov) for suggestions. This is opt-in; tell the user it sends names off the device.

### 5.4 Monitoring Panels — ${SITE}/#panels (the default page)
- A grid of panel cards. Each card lists its observations and, below a divider, its computed indices, as chips coloured by the latest result's status.
- Status filter toggles hide chips by status; "Compact view" shows short names; the search box ("Search markers or panels…") matches panel names, marker names and indices.
- "View panel →" opens Panel Detail.

### 5.5 Panel Detail — ${SITE}/#panels/<panel name> and ${SITE}/#panels/<panel name>/trends
- **Results** tab (default): a table of the panel's observations and then its indices, one column per draw date, newest first. The controls bar has "Show observations from" (panel filter, active only in All Observations), "Find a marker", an SI / US unit switch, and a sample limit (5 / 10 / 15 / All columns).
- Click a value once to select the row, click it again to open a popup with the analyte, date, lab, value, unit and reference range.
- Selecting an index marks the observations it is computed from (and vice versa).
- **Trends** tab: marker summary cards with sparklines, a timeline chart with "Normalized values" (every marker as % of its own reference range on one axis) or "Absolute numbers", a date-range control in the header, a medications lane if medications are recorded, and a result-history table for the selected marker. Readings that cannot be placed on the right scale are listed as "not taken" rather than plotted wrongly.
- The back chevron returns to the grid.

### 5.6 All Observations — ${SITE}/#panels/All%20Observations
- The same Results and Trends tabs as a panel, but across every observation that has a LOINC, with a working "Show observations from" panel picker to narrow it.

### 5.7 Hormonal Pathways — ${SITE}/#pathways
- An illustrated diagram of the hypothalamic-pituitary-gonadal axis with the user's own hormone values placed on it, a ‹ date › stepper to move between draws, and the SI / US switch. Artwork is illustrative, not to scale.

### 5.8 Lipid Transport — ${SITE}/#lipids
- The same kind of diagram for cholesterol and lipoprotein transport, using the Cardiovascular Risk panel's values.

### 5.9 Scheduled Visits — ${SITE}/#plan
- Plan a future blood draw and compare laboratory prices.
- To create a visit: in a Results table (Panel Detail or All Observations), press "+" ("Add a scheduled visit") in the table header, then tick rows in the new "Scheduled" column. Ticking an index also ticks the observations it needs. Pick a target month in that column's header. "Remove this scheduled visit" deletes it.
- The Scheduled Visits page shows one tab per visit: a "Planned for" month selector and a table of the ticked tests with one price column per laboratory, a "Total" row, and the cheapest lab marked "Cheapest". A radio button in a lab's column header picks that lab and shows its own product names; "Show generic names" clears the choice.

### 5.10 Medications — ${SITE}/#medications
- A table of medications and supplements with a January–December grid per year, marking the months each was taken.
- Press "Edit" to change it: "Add medication", type the brand name, optionally add active compounds with doses (for combination drugs) and free-text notes, tick the months taken, then "Done".
- Medications appear as a lane under the Trends chart.

### 5.11 Reference Book — ${SITE}/#reference
- Background pages with cited sources: one page per computed index (formula, meaning, cited ranges), the HP axis, testosterone, mass ↔ molar unit conversion, how units are read, the full LOINC database the app knows (${SITE}/#reference/loinc-database), and FSH.
- Use it to answer "what does this index mean / how is it computed" questions.

### 5.12 Account — ${SITE}/#account
- **Sign in** with Google or Apple for cloud sync (see 5.13). Signing in is optional; everything works without it.
- **Database details**: subject and birth year (when a loaded file carries them) and **Sex**. If no loaded file states the sex, a "Sex" selector ("(not set)" / "female" / "male") appears. Setting it lets sex-specific indices and ranges get a status.
- **"Export all data"**: downloads one .zip with every report file exactly as imported, plus medications, scheduled visits, prices, settings and a manifest. Recommend this as a backup.
- **"Import all data"**: restores such a zip; it replaces everything stored in this browser.
- **"Clear all data"**: press and hold to remove everything the app stores in this browser. Export first if the user wants to keep it.

### 5.13 Cloud sync (optional)
- Signing in copies the data to a private cloud store through Paneloom's own server. On sign-in, existing cloud data is loaded (it wins over local data); if the cloud is empty, the local data is uploaded as the first copy.
- On "Sign out", local changes are saved to the cloud first, then the local copy is cleared only if everything is safely saved. If saving fails, the user stays signed in and sees "Could not back up to the cloud" and can retry.
- There is no continuous background sync: data moves at sign-in and sign-out.
- Cloud sync is currently limited to an allowlist of accounts. Other accounts see "This account is not allowed." — they can keep using the app locally without any account.

### 5.14 Share links (read-only)
- A link of the form ${SITE}/?data=<id> loads a prepared data set published by the site operator. Opening it REPLACES the reports loaded in that browser. Users cannot create share links from the app.

## 6. Where data lives and privacy

- By default everything stays in the user's browser (localStorage) on that device. There is no Paneloom account or database for local use.
- Data leaves the device only through: (1) the opt-in "Check online (NLM)" lookup, which sends test names but never values; (2) optional cloud sync after signing in; (3) share links, which are prepared by the operator, not by users.
- Data in one browser is not visible in another browser or device unless the user exports and imports it, or uses cloud sync.
- Clearing browser site data deletes the stored results — recommend "Export all data" regularly.
- Advise the user not to put patient IDs, medical record numbers or national IDs in the JSON; the extraction prompt already excludes them.

## 7. The import file format

- One JSON object (the "envelope"): {"schema": "${SCHEMA_VERSION}", "sex": optional "female"/"male", "birthYear": optional number, "diagnosticReports": [ ... ]}.
- Each report: "lab" (laboratory name), "collectedAt" (draw date, ISO 8601), optional "identifiers" (visit / order / accession numbers), and "observations".
- Each observation: "loinc" (a code printed on the report, else ""), "rawName" (test name exactly as printed), "value" (number), optionally "rawValue" (text exactly as printed), "unit" (exactly as printed), and "referenceRanges".
- Only schema major version 3 is accepted: any "3.x" string (and the legacy bare number 3). Older formats are rejected.
- Full machine-readable definition: ${SITE}/schema/bloodtests-3.schema.json (JSON Schema draft 2020-12).
- The complete, authoritative extraction rules with a worked example are in section 12. Follow them exactly.

## 8. Addresses a bot or user can use

- ${SITE}/ — the app (JavaScript single-page app; it cannot be operated by fetching URLs).
- ${SITE}${SITE_GUIDE_PATH} — this guide (plain text).
- ${SITE}/#profile, #reports, #reports/<file>, #panels, #panels/<name>, #panels/<name>/trends, #panels/All%20Observations, #pathways, #lipids, #plan, #medications, #reference, #reference/<page>, #account — direct links to each section.
- ${SITE}/schema/bloodtests-3.schema.json — the import file schema.
- ${SITE}/data/analyses.json — the analyte catalog (LOINC codes, names, units) the app knows; ${SITE}/data/monitoring-panels.json and ${SITE}/data/panels.json — panel definitions; ${SITE}/data/laboratories.json — laboratories and prices used by Scheduled Visits.
- ${SITE}/?data=<id> — a read-only share link (section 5.14).
- There is no public API for reading or writing a user's results. The /auth/* and /api/data endpoints exist only for the app's own sign-in and cloud sync and require a signed-in browser session.

## 9. Limitations

- No PDF, image or CSV import — only the JSON envelope (a chatbot does the extraction).
- No diagnosis, no advice, no alerts. Reference ranges come from the lab report; computed-index bands come from cited literature.
- Values and units are never converted in storage. The SI / US switch and charts convert for display only, and only where the conversion is exactly known.
- A result without a LOINC code is stored but does not appear in panels, indices or charts until a code is added (use "Cross-check LOINCs").
- Sex-dependent indices show no status until the sex is known (from the file or the Account page's "Sex" selector). Birth year is recorded but not used for calculations.
- Desktop-first design; phones work but the layout is simpler.
- Local data is per browser and per device.

## 10. Troubleshooting

- **"Not a valid JSON file."** — the file is not valid JSON (often a chatbot added text around it, or the user saved the chat reply instead of the file). Ask the chatbot for the file again, or copy only the JSON object into a .json file.
- **"Could not parse the uploaded file." or another import message** — usually a wrong format: check "schema" is the string "${SCHEMA_VERSION}" and the top-level key is "diagnosticReports". Validate against the schema URL in section 7.
- **Monitoring Panels / All Observations / pathways greyed out and redirect to Diagnostic Reports** — at least one report has errors (red dot). Open it, fix the missing name/value or malformed code, press "Save".
- **A test is missing from panels** — its LOINC is empty or not in the panel. Open the report, run "Cross-check LOINCs", accept a suggestion, "Save".
- **An index shows "–"** — an input is missing or outside the formula's validity range; that is intentional, not a bug.
- **An index or chip is grey** — no reference range, or sex not set for a sex-specific band (set it under Account → Database details).
- **Want to start over** — "Clear local DB" on Diagnostic Reports removes reports only; "Clear all data" on Account removes everything. Then import again.
- **Data disappeared** — browser data was cleared, or a different browser/device/private window is in use. Restore with "Import all data" from a backup zip, or sign in if cloud sync was used.
- **"Sign-in is unavailable here." / "This account is not allowed."** — cloud sync is not available for this account or environment; keep using local mode and back up with "Export all data".
- **A share link shows nothing** — the link's data may no longer be published; it is not something the user can fix.

## 11. One-paragraph summary for the user

Paneloom keeps your blood-test results in your own browser and lines them up across labs by LOINC code. Turn each lab report into a JSON file with a chatbot, add it on the Diagnostic Reports page, fix anything marked red, then browse Monitoring Panels, trends, pathways and computed indices. Back up with "Export all data" on the Account page.

## 12. Extraction instructions (lab report → JSON)

This is the exact text of the app's "Copy the prompt" button. When the user wants you to convert a lab report, follow it as your instructions for that task.

---

${CHATBOT_PROMPT}
`;

const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff',
};

export function isSiteGuidePath(pathname: string): boolean {
  return pathname === SITE_GUIDE_PATH || pathname === `${SITE_GUIDE_PATH}/` || pathname === `${SITE_GUIDE_PATH}.md`;
}

export function handleSiteGuideRequest(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return new Response(request.method === 'HEAD' ? null : SITE_GUIDE, { headers: HEADERS });
}
