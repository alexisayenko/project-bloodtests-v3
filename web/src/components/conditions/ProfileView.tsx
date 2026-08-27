import { useRef, useState } from 'react';
import { generateTestData } from '../../data/generateTestData';
import { parseUploadedResults } from '../../data/parseUpload';
import { pressable } from './ui';
import { exportData } from '../../utils/exportData';
import type { DiagnosticReport } from '../../types';

const ACTION = {
  display: 'inline-block',
  padding: '8px 20px',
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const DISABLED_ACTION = {
  border: '1.5px solid #ccc',
  color: '#999',
  cursor: 'default',
} as const;

const SECTION_DIVIDER = {
  borderTop: '1px solid #e5e5e5',
  marginTop: 24,
  paddingTop: 20,
} as const;

const CHATBOT_PROMPT = `You are helping me build a JSON file of my blood-test results, in a specific schema, to import into a personal lab-results tracker at blood.isayenko.net.

Follow these steps in order and DO NOT ask clarifying questions about the JSON format itself — every rule you need is below. Do ask me about my own data (values, dates, sex, birth year) when needed.

1. Say in one sentence that you will go through my lab reports with me and then give me a JSON file to upload.

2. Ask me to share my lab reports one at a time — pasted text, an uploaded PDF, or a photo of a printed report, whatever I have. Also ask me, once, whether I want to record my biological sex (used to pick the right reference range on tests that print separate ranges for women and men) and birth year (used for age-banded ranges) — both optional, skip if I don't want to answer.

3. For each report, extract:
   - the lab or clinic name
   - the collection/draw date (and time, only if the report prints one)
   - the report's own reference numbers if printed (order number, accession number, visit number) — never a patient ID, medical record number, or national ID
   - every test result: the test name exactly as printed, the numeric result value, the unit, and every reference range/band printed (including separate ranges for men/women, or by age, if shown)
   Keep asking me for the next report until I say I'm done. If a report is unclear or a value is illegible, ask me about that specific value — never guess a number.

4. For every test result, include its LOINC code (the universal lab-test identifier from loinc.org) when you can look it up or already know it with high confidence. If you don't know the code, or aren't sure, set "loinc" to an empty string ("") rather than guessing — the app will let you fill in missing codes yourself afterward. Never invent or guess a code: a wrong one is worse than a blank one. When in doubt, leave it empty.

5. Build ONE JSON object in exactly this shape:
{
  "schema": 1,
  "sex": "female",
  "birthYear": 1975,
  "diagnosticReports": [
    {
      "lab": "Quest Diagnostics",
      "collectedAt": "2024-06-15T00:00:00Z",
      "observations": [
        {
          "loinc": "2093-3",
          "name": "Total Cholesterol",
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

Field rules — apply silently, do not ask me about any of these:
   - "schema": always the literal number 1.
   - "sex" / "birthYear": include only if I gave them in step 2; otherwise omit both keys entirely.
   - "diagnosticReports": one object per report/draw I send you, even multiple reports from the same day and lab.
   - "lab": the lab/clinic name as printed; use "Unknown Lab" if the report doesn't state one.
   - "collectedAt": the draw date as an ISO timestamp. If the report prints only a date, use "T00:00:00Z" for the time part (e.g. "2024-06-15T00:00:00Z"). If it prints an actual draw time, use that instead, still ending in "Z".
   - "identifiers": only add this object, with only the keys "visit" / "order" / "accession", when the report prints its own report-level reference number. Never put a patient ID, medical record number, or national ID here or anywhere else in the file.
   - "observations": one entry per test result on the report — include every result, whether or not you know its LOINC.
   - "loinc": the LOINC code when you're confident of it, otherwise an empty string "" — always include the key, never omit it (see step 4).
   - "name": the test name exactly as printed (required).
   - "value": the numeric result as a JSON number (required for all numeric results — always include when the report prints a number). Omit this key only if the result is purely qualitative text like "Negative" or "Not Detected".
   - "comparator": one of "<", "<=", ">=", ">" — only when the report prints a value with that qualifier (e.g. "<0.5"); pair it with "value" holding the bare number (0.5).
   - "rawValue": the result exactly as printed, whenever it's non-numeric (e.g. "Negative", "Not Detected") or worth keeping verbatim alongside a comparator.
   - "unit": copied exactly as printed — omit if none.
   - "referenceRanges": an array, one entry per band the report prints for this result. Each entry can have "low", "high" (inclusive numeric bounds), "label" (the report's own name for the band, e.g. "Desirable"), "text" (the range exactly as printed, whenever bounds alone can't capture it), "appliesTo": {"sex": "female"} or {"sex": "male"} (only when the report prints separate ranges for women and men), and "ageLow"/"ageHigh" (only when the report prints an age-banded range). Omit any sub-field the report doesn't specify.
   - "interpretation": one of "N" (normal), "A" (abnormal), "H" (high), "L" (low), "HH" / "LL" (critical), "POS" / "NEG" — only when the report itself prints a flag or verdict (an arrow, a letter, positive/negative), never something you infer yourself.
   - "method": the assay/method as printed (e.g. "CHOD-POD"), only if stated.
   - Never invent a test, value, unit, range, or code that isn't on the report I gave you.

6. Print the JSON in a single fenced code block (\`\`\`json … \`\`\`) and nothing else inside the block — no comments, no trailing text, no invented data.

7. After that, tell me:
   - Select and copy the entire JSON code block.
   - Paste it into a text editor (Notepad, VS Code, TextEdit, etc.).
   - Save the file as a .json file with a descriptive name including the date (e.g., "blood-results-2026-08-19.json").
   - Go to https://blood.isayenko.net, click "Upload raw JSON" on the Get Started page, and select your saved .json file.
   - Warn: uploading REPLACES whatever is currently loaded there; it does not merge. Nothing leaves your device — all data is processed and stored locally in the browser only.

Start now with step 1.`;

export function ProfileView({
  sessionCount,
  uploadError,
  uploadFile,
  loadGenerated,
  clearData,
  sessions = [],
}: Readonly<{
  sessionCount: number;
  uploadError: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: ReturnType<typeof generateTestData>) => void;
  clearData: () => void;
  sessions?: DiagnosticReport[];
}>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(CHATBOT_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleFileSelected(file: File) {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      // error will be shown by existing error handling
      return;
    }

    try {
      const groups = parseUploadedResults(json);
      loadGenerated(groups);
      // Navigate to #reports after successful upload
      window.history.pushState(null, '', '#reports');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      // error will be shown by existing error handling
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Get Started</h1>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
        A LOINC-coded blood-test monitoring tool. Upload a lab-results export and it is organized into monitoring
        panels by condition and organ system, tracked over time against reference ranges and computed indices.
      </div>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
        All processing occurs locally, within this browser. Uploaded results are parsed client-side and persisted
        only to this device's local storage; no data is transmitted to, or retained by, any server.
      </div>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Every reference range and computed index is sourced from a cited paper or clinical guideline, and labeled
        by how strong that evidence is: <b>guideline</b> (a professional-society standard), <b>consensus</b> (a
        widely used but secondary source), or <b>heuristic</b> (orientation only — no validated cutoff).
      </div>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Create your first JSON / analysis DB file</h2>
        <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
          No lab-results file yet? Build one from your printed reports or PDFs in a few steps.
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>1. Chatbot prompt</div>
          <div
            {...pressable(handleCopyPrompt)}
            style={{
              ...ACTION,
              border: '1.5px solid #1971c2',
              color: '#1971c2',
              marginBottom: 8,
            }}
          >
            {copiedPrompt ? '✓ Copied!' : 'Copy chatbot prompt'}
          </div>
          <details>
            <summary style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>Show the full prompt</summary>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                border: '1px solid #e5e5e5',
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                color: '#444',
              }}
            >
              {CHATBOT_PROMPT}
            </pre>
          </details>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>2. Upload initial raw parsed data</div>
          <label style={{ ...ACTION, border: '1.5px solid #1971c2', color: '#1971c2' }}>
            Upload raw JSON
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleFileSelected(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            3. Manually amend it to meet requirements (LOINCs, unparsed units, etc.)
          </div>
          <div style={{ ...ACTION, ...DISABLED_ACTION }}>Open editor (coming soon)</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>4. Export local DB into JSON (with hash)</div>
          <div
            {...pressable(async () => {
              setIsExporting(true);
              try {
                await exportData(sessions);
              } finally {
                setIsExporting(false);
              }
            })}
            style={{
              ...ACTION,
              ...(sessionCount === 0 ? DISABLED_ACTION : { border: '1.5px solid #1971c2', color: '#1971c2' }),
              cursor: sessionCount === 0 || isExporting ? 'default' : 'pointer',
            }}
          >
            {isExporting ? 'Exporting...' : 'Export JSON'}
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>5. Clear local DB</div>
          <div
            {...pressable(() => {
              if (window.confirm('Remove all loaded lab reports?')) clearData();
            })}
            style={{ ...ACTION, border: '1.5px solid #ea4335', color: '#ea4335' }}
          >
            Clear
          </div>
        </div>
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Already have one?</h2>
        <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
          Upload it — it replaces whatever is currently loaded ({sessionCount} report{sessionCount === 1 ? '' : 's'}{' '}
          currently).
        </div>
        <label style={{ ...ACTION, border: '1.5px solid #1971c2', background: '#1971c2', color: '#fff' }}>
          {'Upload JSON'}
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {uploadError && <div style={{ color: '#ea4335', fontSize: 14, marginTop: 12 }}>{uploadError}</div>}
      </div>

      <div style={SECTION_DIVIDER}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Want a demo first?</h2>
        <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>
          Add 6 randomly generated lab reports — merges with whatever is already loaded ({sessionCount} report
          {sessionCount === 1 ? '' : 's'} currently).
        </div>
        <div
          {...pressable(() => loadGenerated(generateTestData()))}
          style={{ ...ACTION, border: '1.5px solid #1971c2', color: '#1971c2' }}
        >
          Generate Test Data
        </div>
      </div>
    </>
  );
}
