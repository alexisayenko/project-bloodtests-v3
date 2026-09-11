// The instructions a user pastes into a chatbot to turn lab PDFs into a v3
// interchange envelope — it tracks the schema (docs/tech/interchange-format.md),
// not the UI that shows it.
export const CHATBOT_PROMPT = `You are helping me build a JSON file of my blood-test results, in a specific schema, to import into a personal lab-results tracker at blood.isayenko.net.

Follow these steps in order and DO NOT ask clarifying questions about the JSON format itself — every rule you need is below. Do ask me about my own data (values, dates, sex, birth year) when needed.

1. Say in one sentence that you will go through my lab reports with me and then give me a JSON file to upload.

2. Ask me to share my lab reports one at a time — pasted text, an uploaded PDF, or a photo of a printed report, whatever I have. Also ask me, once, whether I want to record my biological sex (used to pick the right reference range on tests that print separate ranges for women and men) and birth year (used for age-banded ranges) — both optional, skip if I don't want to answer.

3. For each report, extract:
   - the lab or clinic name
   - the collection/draw date (and time, only if the report prints one)
   - the report's own reference numbers if printed (order number, accession number, visit number) — never a patient ID, medical record number, or national ID
   - every test result: the test name exactly as printed, the numeric result value, the unit, and every reference range/band printed (including separate ranges for men/women, or by age, if shown)
   Watch out for:
   - A multi-page or multi-section document (e.g. "Hormones" then "Immunology") from one draw is ONE report — same lab + same draw date/time means one diagnosticReports entry, never one per section or page. Conversely, one PDF containing several draw dates is several reports — split by draw date.
   - Footnote or flag markers printed next to results (superscript numbers, asterisks, arrows) are not part of the value or the test name — never read them into either.
   - Test names stay exactly as printed even when not in English — never translate them. A name printed across several lines (or in two languages) becomes one single-line string joined with single spaces — never put a line break inside "rawName".
   - A result the report marks as pending — "Not ready", "Pending", "To follow", or an empty result cell — is not a result: skip that observation entirely and mention to me that it was skipped, so I can re-import it from the follow-up report later.
   Keep asking me for the next report until I say I'm done. If a report is unclear or a value is illegible, ask me about that specific value — never guess a number.

4. LOINC codes: transcribe a code ONLY when the report itself prints one (often a small code column like "2093-3" next to each test), copied verbatim. NEVER supply a code from your own knowledge or by looking one up — the app derives each code deterministically from the test name and unit, and a code you add from memory only corrupts that check. Only a printed code matching the LOINC pattern — 1-7 digits, a hyphen, one check digit (e.g. "2093-3") — counts as a LOINC: a printed code without that shape (e.g. "900101") is the lab's internal code, never a LOINC — don't put it anywhere, and treat that test as having no printed code. In every other case set "loinc" to an empty string ("").

5. Build ONE JSON object in exactly this shape:
{
  "schema": "3.1",
  "sex": "female",
  "birthYear": 1975,
  "diagnosticReports": [
    {
      "lab": "Quest Diagnostics",
      "collectedAt": "2024-06-15T00:00:00Z",
      "observations": [
        {
          "loinc": "2093-3",
          "rawName": "Total Cholesterol",
          "value": 186.65,
          "unit": "mg/dL",
          "referenceRanges": [
            { "high": 200, "text": "< 200.00 Desirable" }
          ]
        }
      ]
    }
  ]
}

The same shape as a JSON Schema, if you can validate against one: https://blood.isayenko.net/schema/bloodtests-3.schema.json — the rules below are complete on their own, so don't fetch it unless validating is free for you.

Field rules — apply silently, do not ask me about any of these:
   - "schema": always the literal string "3.1" — with the quotes, a string and not a number.
   - "sex" / "birthYear": include only if I gave them in step 2; otherwise omit both keys entirely.
   - "diagnosticReports": one object per report/draw I send you, even multiple reports from the same day and lab.
   - "lab": the lab/clinic name as printed; use "Unknown Lab" if the report doesn't state one.
   - "collectedAt": the draw date as an ISO timestamp. If the report prints only a date, use "T00:00:00Z" for the time part (e.g. "2024-06-15T00:00:00Z"). If it prints an actual draw time, use that instead, still ending in "Z".
   - "identifiers": only add this object, with only the keys "visit" / "order" / "accession", when the report prints its own report-level reference number. Never put a patient ID, medical record number, or national ID here or anywhere else in the file.
   - "observations": one entry per test result on the report — include every result, whether or not you know its LOINC.
   - "loinc": the code exactly as the report prints it when it prints one (see step 4), otherwise an empty string "" — always include the key, never omit it, and never fill it from your own knowledge.
   - "rawName": the test name exactly as printed (required). The key is "rawName", not "name" — the app derives the friendly name from the LOINC code itself, so this field only ever holds what the paper said.
   - "value": the numeric result as a JSON number (required for all numeric results — always include when the report prints a number). Normalize decimal commas to dots ("2,149" → 2.149) and drop thousands separators — JSON numbers only. Omit this key only if the result is purely qualitative text like "Negative" or "Not Detected".
   - "comparator": one of "<", "<=", ">=", ">" — only when the report prints a value with that qualifier (e.g. "<0.5"); pair it with "value" holding the bare number (0.5).
   - "rawValue": the result exactly as printed, whenever it's non-numeric (e.g. "Negative", "Not Detected") or worth keeping verbatim alongside a comparator.
   - "unit": copied exactly as printed, including special characters (μ, ×10⁹/L, %) — never substitute "u" for "μ" or simplify exponents; omit if none.
   - "referenceRanges": an array, one entry per band the report prints for this result. Each entry can have "low", "high" (inclusive numeric bounds), "label" (the report's own name for the band, e.g. "Desirable"), "text" (the range exactly as printed, whenever bounds alone can't capture it), "appliesTo": {"sex": "female"} or {"sex": "male"} (only when the report prints separate ranges for women and men), and "ageLow"/"ageHigh" (only when the report prints an age-banded range). Omit any sub-field the report doesn't specify.
   - "interpretation": one of "N" (normal), "A" (abnormal), "H" (high), "L" (low), "HH" / "LL" (critical), "POS" / "NEG" — only when the report itself prints a flag or verdict (an arrow, a letter, positive/negative), never something you infer yourself.
   - "method": the assay/method as printed (e.g. "CHOD-POD"), only if stated.
   - Never invent a test, value, unit, range, or code that isn't on the report I gave you.

6. Before producing the file, self-check silently: count the results printed on each report and confirm the JSON has exactly that many observations for it (minus any pending ones you skipped), each with its value (or rawValue) filled in — if any is missing, go back and fix it, asking me only about illegible ones. Then list for me every draw date + lab you included, one line each, and ask me to confirm no report I sent is missing before you continue.

7. Deliver the JSON as a downloadable file, not as text in the chat:
   - Create an actual .json file named with the draw date (e.g. "blood-results-2026-08-19.json") and give me a direct download link to it. Use whatever file-creation ability you have (code interpreter, canvas, artifacts, file output).
   - Do NOT print the JSON content into the chat — it's long and would only confuse me. The file must contain nothing but the strictly valid JSON (no comments, no trailing commas; it must pass JSON.parse).
   - Save the file as UTF-8. Non-Latin text (Greek, Cyrillic, etc.) in lab names, labels, or methods must survive intact — if your output would turn "ΧΗΜΕΙΟ" into garbage like "Î§ÎÎÎÎÎ", fix the encoding before handing me the file; when you can't guarantee the encoding, transliterate to Latin instead of emitting mojibake.
   - Only if you truly cannot produce a downloadable file, fall back to printing the JSON in a single fenced code block (\`\`\`json … \`\`\`) and tell me to copy it into a text editor and save it as a .json file myself.

8. After that, tell me:
   - Download the file.
   - Go to https://blood.isayenko.net, open the Diagnostic Reports page, click "Add new Diagnostic Report", and select the downloaded .json file.
   - Note: adding merges into whatever is already loaded there. Nothing leaves your device — all data is processed and stored locally in the browser only.

Start now with step 1.`;
