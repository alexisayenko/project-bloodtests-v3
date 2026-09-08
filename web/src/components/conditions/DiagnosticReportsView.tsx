import { useMemo, useState } from 'react';
import type { DiagnosticReport } from '../../types';
import { validateDiagnosticReports, groupHasErrors, groupHasWarnings } from '../../data/validateDiagnosticReports';
import { parseUploadedResults } from '../../data/parseUpload';
import { formatFullDate, pressable } from './ui';
import { exportData } from '../../utils/exportData';
import { loadEnvelopeMeta, saveEnvelopeMeta, type EnvelopeMeta } from '../../data/envelopeMeta';
import { CHATBOT_PROMPT } from '../../data/chatbotPrompt';

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
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCopyPrompt();
              }}
              style={{
                ...ACTION,
                padding: '2px 14px',
                fontSize: 13,
                border: '1.5px solid #1971c2',
                color: '#1971c2',
                margin: '0 8px',
                background: 'none',
                font: 'inherit',
              }}
            >
              {copiedPrompt ? '✓ Copied!' : 'Copy'}
            </button>{' '}
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
        </label>{' '}
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
                Import JSON{' '}
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
