import { useMemo, useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { validateDiagnosticReports, groupHasErrors, groupHasWarnings } from '../../data/validateDiagnosticReports';
import { parseUploadedResults } from '../../data/parseUpload';
import { formatFullDate, pressable } from './ui';
import { exportData } from '../../utils/exportData';
import { loadEnvelopeMeta, saveEnvelopeMeta, type EnvelopeMeta } from '../../data/envelopeMeta';

const th = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1.5px solid #1971c2',
  whiteSpace: 'nowrap',
} as const;
const td = { padding: '8px 12px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' } as const;

const FIELD_INPUT = {
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: 13,
  padding: '6px 8px',
  fontFamily: 'inherit',
} as const;

const ACTION = {
  display: 'inline-block',
  padding: '8px 20px',
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
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
   Watch out for:
   - A multi-page or multi-section document (e.g. "Hormones" then "Immunology") from one draw is ONE report — same lab + same draw date/time means one diagnosticReports entry, never one per section or page. Conversely, one PDF containing several draw dates is several reports — split by draw date.
   - Footnote or flag markers printed next to results (superscript numbers, asterisks, arrows) are not part of the value or the test name — never read them into either.
   - Test names stay exactly as printed even when not in English — never translate them. A name printed across several lines (or in two languages) becomes one single-line string joined with single spaces — never put a line break inside "name".
   - A result the report marks as pending — "Not ready", "Pending", "To follow", or an empty result cell — is not a result: skip that observation entirely and mention to me that it was skipped, so I can re-import it from the follow-up report later.
   Keep asking me for the next report until I say I'm done. If a report is unclear or a value is illegible, ask me about that specific value — never guess a number.

4. For every test result, include its LOINC code (the universal lab-test identifier from loinc.org). If the report itself prints LOINC codes (often a small code column like "2093-3" next to each test), use those verbatim — they always win over your own knowledge. But only a code matching the LOINC pattern — 1-7 digits, a hyphen, one check digit (e.g. "2093-3") — counts as a LOINC: a printed code without that shape (e.g. "900101") is the lab's internal code, never a LOINC — don't put it anywhere, and treat that test as having no printed code. Otherwise include a code only when you can look it up or already know it with high confidence. If you don't know the code, or aren't sure, set "loinc" to an empty string ("") rather than guessing — the app will let you fill in missing codes yourself afterward. Never invent or guess a code: a wrong one is worse than a blank one. When in doubt, leave it empty.

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

export function DiagnosticReportsView({
  sessions,
  onOpenDetail,
  onAddReports,
  onImportFile,
  importError,
  onClear,
}: Readonly<{
  sessions: DiagnosticReport[];
  onOpenDetail: (file: string) => void;
  onAddReports: (groups: ReturnType<typeof parseUploadedResults>) => void;
  onImportFile: (file: File) => Promise<void>;
  importError: string | null;
  onClear: () => void;
}>) {
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [meta, setMeta] = useState<EnvelopeMeta>(() => loadEnvelopeMeta());
  const issues = useMemo(() => validateDiagnosticReports(sessions), [sessions]);

  function updateMeta(patch: Partial<EnvelopeMeta>) {
    setMeta((prev) => {
      const next = { ...prev, ...patch };
      saveEnvelopeMeta(next);
      return next;
    });
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(CHATBOT_PROMPT);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function handleAddFile(file: File) {
    setAddError(null);
    setAddedCount(null);
    setIsAdding(true);
    // Let the browser paint the "Adding…" state before the synchronous
    // JSON.parse/parseUploadedResults work freezes the main thread.
    await new Promise((r) => setTimeout(r, 50));
    try {
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        setAddError('Not a valid JSON file.');
        return;
      }
      try {
        const groups = parseUploadedResults(json);
        onAddReports(groups);
        setAddedCount(groups.length);
        setTimeout(() => setAddedCount(null), 4000);
      } catch (e) {
        setAddError(e instanceof Error ? e.message : 'Could not parse the uploaded file.');
      }
    } finally {
      setIsAdding(false);
    }
  }

  const addBlock = (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 24,
        maxWidth: 640,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Add a report</div>
      <div style={{ marginBottom: 16 }}>
        <details>
          <summary style={{ color: '#444', fontSize: 14, cursor: 'pointer', listStyle: 'none' }}>
            1.{' '}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyPrompt();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCopyPrompt();
                }
              }}
              style={{ ...ACTION, padding: '2px 14px', fontSize: 13, border: '1.5px solid #1971c2', color: '#1971c2', margin: '0 8px' }}
            >
              {copiedPrompt ? '✓ Copied!' : 'Copy'}
            </span>
            the chatbot prompt <span style={{ color: '#1971c2' }}>›</span>
          </summary>
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
      <div style={{ color: '#444', fontSize: 14, marginBottom: 16 }}>
        2. Paste into your favourite chatbot and let it parse your Reports from PDFs and Image formats.
      </div>
      <div style={{ color: '#444', fontSize: 14 }}>
        3.{' '}
        <label
          style={{
            ...ACTION,
            padding: '2px 14px',
            fontSize: 13,
            border: `1.5px solid ${isAdding ? '#ccc' : '#1971c2'}`,
            color: isAdding ? '#999' : '#1971c2',
            cursor: isAdding ? 'default' : 'pointer',
            margin: '0 8px',
          }}
        >
          {isAdding ? 'Adding…' : 'Add'}
          <input
            type="file"
            accept=".json,application/json"
            disabled={isAdding}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) handleAddFile(file);
              e.currentTarget.value = '';
            }}
          />
        </label>
        a new Diagnostic Report pre-generated by your chatbot.
      </div>
      {addError && <div style={{ color: '#ea4335', fontSize: 14, marginTop: 12 }}>{addError}</div>}
      {addedCount != null && (
        <div style={{ color: '#34a853', fontSize: 14, marginTop: 12 }}>
          ✓ Added {addedCount} report{addedCount === 1 ? '' : 's'}.
        </div>
      )}
    </div>
  );

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>Diagnostic Reports</h1>
      {sessions.length > 0 && (
        <details style={{ marginBottom: 24 }}>
          <summary style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, cursor: 'pointer', listStyle: 'none' }}>
            Database details <span style={{ color: '#1971c2' }}>›</span>
          </summary>
          <div
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              padding: '16px 20px',
              maxWidth: 480,
              display: 'grid',
              gridTemplateColumns: '90px 1fr',
              columnGap: 14,
              rowGap: 12,
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#888', textAlign: 'right' }}>Generated at</span>
            <span style={{ color: '#888' }}>
              {meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : '—'}
              <span style={{ color: '#bbb', fontSize: 11, marginLeft: 8 }}>updates on each export</span>
            </span>
            <span style={{ color: '#444', fontWeight: 600, textAlign: 'right' }}>Subject</span>
            <input
              type="text"
              value={meta.subject ?? ''}
              onChange={(e) => updateMeta({ subject: e.currentTarget.value || undefined })}
              style={{ ...FIELD_INPUT, width: '100%', boxSizing: 'border-box' }}
            />
            <span style={{ color: '#444', fontWeight: 600, textAlign: 'right' }}>Sex</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={meta.sex ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  updateMeta({ sex: v === 'female' || v === 'male' ? v : undefined });
                }}
                style={FIELD_INPUT}
              >
                <option value="">(not set)</option>
                <option value="female">female</option>
                <option value="male">male</option>
              </select>
              <span style={{ color: '#444', fontWeight: 600 }}>Birth year</span>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                step={1}
                value={meta.birthYear ?? ''}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  updateMeta({ birthYear: v === '' ? undefined : Number(v) });
                }}
                style={{ ...FIELD_INPUT, width: 90 }}
              />
            </div>
            <span style={{ color: '#444', fontWeight: 600, textAlign: 'right', alignSelf: 'start', marginTop: 6 }}>
              Notes
            </span>
            <textarea
              rows={4}
              value={meta.notes ?? ''}
              onChange={(e) => updateMeta({ notes: e.currentTarget.value || undefined })}
              style={{ ...FIELD_INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        </details>
      )}
      {sessions.length > 0 && (
        <div style={{ overflowX: 'auto', margin: '32px 0' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}></th>
                  <th style={th}>Date</th>
                  <th style={th}>Lab</th>
                  <th style={th}>Observations</th>
                </tr>
              </thead>
              <tbody>
                {/* sessions is already date-descending, as produced by parseUpload/ResultsContext */}
                {sessions.map((group) => (
                  <tr key={group.file} {...pressable(() => onOpenDetail(group.file))} style={{ cursor: 'pointer' }}>
                    <td style={td}>
                      {groupHasErrors(group.file, issues) && (
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ea4335' }} title="Errors" />
                      )}
                      {!groupHasErrors(group.file, issues) && groupHasWarnings(group.file, issues) && (
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbc04' }} title="Warnings" />
                      )}
                    </td>
                    <td style={td}>{formatFullDate(group.date)}</td>
                    <td style={td}>{group.place}</td>
                    <td style={td}>{group.itemCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
      {addBlock}
      {sessions.length > 0 && (
        <div
          style={{
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 24,
            maxWidth: 640,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Back up your database</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
              Export it as a JSON file, or import one to replace it.
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                {...pressable(async () => {
                  setIsExporting(true);
                  try {
                    const generatedAt = await exportData(sessions, meta);
                    updateMeta({ generatedAt });
                  } finally {
                    setIsExporting(false);
                  }
                })}
                style={{ ...ACTION, border: '1.5px solid #1971c2', color: '#1971c2' }}
              >
                {isExporting ? 'Exporting...' : 'Export JSON'}
              </div>
              <label style={{ ...ACTION, border: '1.5px solid #1971c2', color: '#1971c2' }}>
                Import JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) onImportFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {importError && <div style={{ color: '#ea4335', fontSize: 14, marginTop: 12 }}>{importError}</div>}
          </div>
          <div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Clear local DB</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
              Removes all loaded reports from this browser. Export first if you want to keep them.
            </div>
            <div
              {...pressable(() => {
                if (window.confirm('Remove all loaded lab reports?')) onClear();
              })}
              style={{ ...ACTION, border: '1.5px solid #ea4335', color: '#ea4335' }}
            >
              Clear
            </div>
          </div>
        </div>
      )}
    </>
  );
}
