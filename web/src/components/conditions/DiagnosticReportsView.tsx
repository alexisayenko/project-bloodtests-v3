import { useId, useMemo, useState, type ReactNode } from 'react';
import type { DiagnosticReport } from '../../types';
import { validateDiagnosticReports, groupHasErrors, groupHasWarnings } from '../../data/validateDiagnosticReports';
import { parseUploadedResults } from '../../data/parseUpload';
import { formatFullDate, pressable } from './ui';
import { CHATBOT_PROMPT } from '../../data/chatbotPrompt';
import { FileText, CheckCircle2, Sparkles, ChevronRight, Trash2 } from 'lucide-react';
import { PageHeader } from './PageHeader';
import {
  Button,
  CARD_TABLE_TD,
  CARD_TABLE_TH,
  Card,
  CardHeader,
  CardTitle,
  DangerCard,
  FileButton,
  IconBadge,
  StatusDot,
  TABLE,
  TABLE_CARD,
} from '../primitives';
import { COLOR, RADIUS, SPACE } from '../../styles/tokens';

const COLUMN_WIDTH = 960;
const SECTION = { marginBottom: SPACE[5], maxWidth: COLUMN_WIDTH } as const;
const STACKED_CARD = { display: 'flex', flexDirection: 'column', gap: SPACE[4] } as const;
const ACTIONS = { display: 'flex', flexWrap: 'wrap', gap: SPACE[3], alignItems: 'center', marginTop: 'auto' } as const;
const STEP_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: SPACE[3],
  listStyle: 'none',
  margin: `${SPACE[4]} 0 0`,
  padding: 0,
} as const;
const STEP_TILE = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE[2],
  padding: '14px 16px',
  background: COLOR.surfaceMint,
  border: `1px solid ${COLOR.accentLine}`,
  borderRadius: RADIUS.control,
} as const;
const LINK_BUTTON = {
  border: 'none',
  background: 'none',
  padding: 0,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  color: COLOR.link,
  cursor: 'pointer',
} as const;

function StepTile({ step, title, children, action }: Readonly<{ step: number; title: string; children: ReactNode; action?: ReactNode }>) {
  return (
    <li style={STEP_TILE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: COLOR.primary,
            color: COLOR.primaryText,
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {step}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLOR.navy }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: COLOR.textSecondary }}>{children}</div>
      {action && <div style={ACTIONS}>{action}</div>}
    </li>
  );
}

export function DiagnosticReportsView({
  sessions,
  onOpenDetail,
  onAddReports,
  onClear,
}: Readonly<{
  sessions: DiagnosticReport[];
  onOpenDetail: (file: string) => void;
  onAddReports: (groups: ReturnType<typeof parseUploadedResults>) => void;
  onClear: () => void;
}>) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const issues = useMemo(() => validateDiagnosticReports(sessions), [sessions]);
  const promptId = useId();

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
    <Card style={SECTION}>
      <CardHeader
        icon={<IconBadge icon={Sparkles} />}
        title="Add a report"
        description="Let a chatbot read your lab PDFs or photos, then add the JSON it builds."
      />
      <ol style={STEP_GRID}>
        <StepTile
          step={1}
          title="Copy the prompt"
          action={
            <>
              <Button size="sm" variant="primary" onClick={() => void handleCopyPrompt()}>
                {copiedPrompt ? '✓ Copied!' : 'Copy'}
              </Button>
              <button
                type="button"
                aria-expanded={showPrompt}
                aria-controls={promptId}
                onClick={() => setShowPrompt((v) => !v)}
                style={LINK_BUTTON}
              >
                {showPrompt ? 'Hide prompt' : 'View prompt'}
              </button>
            </>
          }
        >
          The chatbot prompt describes exactly which JSON to build.
        </StepTile>
        <StepTile step={2} title="Paste into a chatbot">
          Paste into your favourite chatbot and let it parse your Reports from PDFs and Image formats.
        </StepTile>
        <StepTile
          step={3}
          title="Add the JSON"
          action={
            <FileButton size="sm" variant="primary" accept=".json,application/json" disabled={isAdding} onFile={handleAddFile}>
              {isAdding ? 'Adding…' : 'Add'}
            </FileButton>
          }
        >
          Add a new Diagnostic Report pre-generated by your chatbot.
        </StepTile>
      </ol>
      <pre
        id={promptId}
        hidden={!showPrompt}
        style={{
          margin: `${SPACE[3]} 0 0`,
          padding: SPACE[3],
          maxHeight: 360,
          overflow: 'auto',
          background: COLOR.surfaceMuted,
          border: `1px solid ${COLOR.borderSubtle}`,
          borderRadius: RADIUS.control,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          color: COLOR.textSecondary,
        }}
      >
        {CHATBOT_PROMPT}
      </pre>
      {addError && <div style={{ color: COLOR.statusBadText, fontSize: 14, marginTop: SPACE[3] }}>{addError}</div>}
      {addedCount != null && (
        <div style={{ color: COLOR.statusOkText, fontSize: 14, marginTop: SPACE[3] }}>
          ✓ Added {addedCount} report{addedCount === 1 ? '' : 's'}.
        </div>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        overline="Laboratory Encounter Archive"
        titlePrimary="Diagnostic"
        titleAccent="Reports"
        description={[
          'Uploaded laboratory sessions organized chronologically by draw date and provider.',
          'Inspect raw lab results, verify validation rules, or import new reports.',
        ]}
        pillars={[
          { icon: FileText, line1: 'Chronological', line2: 'report archive' },
          { icon: CheckCircle2, line1: 'Validation & error', line2: 'gating checks' },
          { icon: Sparkles, line1: 'Chatbot prompt', line2: 'JSON extraction' },
        ]}
      />
      {sessions.length > 0 && (
        <Card style={{ ...SECTION, ...TABLE_CARD }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE[3], padding: '16px 20px' }}>
            <CardTitle>Reports</CardTitle>
            <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.textMuted }}>
              {sessions.length} report{sessions.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...TABLE, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...CARD_TABLE_TH, width: 20, paddingRight: 0 }}></th>
                  <th style={CARD_TABLE_TH}>Date</th>
                  <th style={CARD_TABLE_TH}>Lab</th>
                  <th style={{ ...CARD_TABLE_TH, textAlign: 'right' }}>Observations</th>
                  <th style={{ ...CARD_TABLE_TH, width: 20, paddingLeft: 0 }}></th>
                </tr>
              </thead>
              <tbody>
                {/* sessions is already date-descending, as produced by parseUpload/ResultsContext */}
                {sessions.map((group, i) => {
                  const hasErrors = groupHasErrors(group.file, issues);
                  const hasWarnings = !hasErrors && groupHasWarnings(group.file, issues);
                  const td = i === sessions.length - 1 ? { ...CARD_TABLE_TD, borderBottom: 'none' } : CARD_TABLE_TD;
                  return (
                    <tr key={group.file} {...pressable(() => onOpenDetail(group.file))} style={{ cursor: 'pointer' }}>
                      <td style={{ ...td, paddingRight: 0 }}>
                        {hasErrors && <StatusDot tone="bad" title="Errors" />}
                        {hasWarnings && <StatusDot tone="warn" title="Warnings" />}
                        {!hasErrors && !hasWarnings && <StatusDot tone="ok" title="No issues" />}
                      </td>
                      <td style={{ ...td, color: COLOR.textSecondary }}>{formatFullDate(group.date)}</td>
                      <td style={{ ...td, fontWeight: 500, color: COLOR.navy }}>{group.place}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.itemCount}</td>
                      <td style={{ ...td, paddingLeft: 0 }}>
                        <ChevronRight size={16} color={COLOR.link} aria-hidden="true" style={{ display: 'block' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {addBlock}
      {sessions.length > 0 && (
        <DangerCard style={{ ...SECTION, ...STACKED_CARD }}>
          <CardHeader
            icon={<IconBadge icon={Trash2} color={COLOR.statusBadText} background={COLOR.statusBadBg} />}
            title="Clear local DB"
            description="Removes all loaded reports from this browser. Back up from Account first if you want to keep them."
          />
          <div style={ACTIONS}>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Remove all loaded lab reports?')) onClear();
              }}
            >
              Clear
            </Button>
          </div>
        </DangerCard>
      )}
    </>
  );
}
