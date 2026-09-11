import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Result, DiagnosticReport } from '../../types';
import {
  validateDiagnosticReports,
  groupHasErrors,
  type ValidationIssue,
} from '../../data/validateDiagnosticReports';
import { formatFullDate, pressable } from './ui';
import {
  applyFieldEdit,
  getChipSuggestions,
  getDotColor,
  getDotTitle,
  getMismatchMessage,
  getUnitLabel,
  pluralize,
  referenceRangeOf,
  resolvedNameOf,
  saveButtonLabel,
  unitRepairFor,
  type EditableField,
} from './reportDetailHelpers';
import { useLoincCrossCheck, type LoincCrossCheck } from './useLoincCrossCheck';
import { Button, EmptyState, FIELD_INPUT, StatusDot, TABLE, TABLE_TD, TABLE_TH as th } from '../primitives';
import { COLOR } from '../../styles/tokens';

const td = { ...TABLE_TD, whiteSpace: 'normal' } as const;
const cellInput = { ...FIELD_INPUT, padding: '2px 4px' } as const;

interface ReportResultsSectionProps {
  items: Result[];
  group: DiagnosticReport | undefined;
  issues: ValidationIssue[];
  crossCheck: LoincCrossCheck;
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  draftItems: Result[] | null;
  isSaving: boolean;
  onEditItem: (index: number, field: EditableField, newValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ReportResultsSection({
  items,
  group,
  issues,
  crossCheck,
  errorCount,
  warningCount,
  hasErrors,
  draftItems,
  isSaving,
  onEditItem,
  onSave,
  onCancel,
}: Readonly<ReportResultsSectionProps>) {
  const { checkResults, nlmState, nlmByCode, nlmSuggestions, autoFilledCount, unresolvedRows } = crossCheck;
  const unitRepairs = useMemo(() => items.map(unitRepairFor), [items]);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <Button size="sm" onClick={crossCheck.onCrossCheck}>
          Cross-check LOINCs
        </Button>
        {autoFilledCount > 0 && (
          <span style={{ fontSize: 13, color: COLOR.statusOkText }}>
            ✓ {autoFilledCount} code{pluralize(autoFilledCount)} filled automatically — review and Save
          </span>
        )}
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={th}></th>
              <th style={th}>Test name</th>
              <th style={th}>LOINC</th>
              <th style={th}>Value</th>
              <th style={th}>Unit</th>
              <th style={th}>Reference range</th>
              <th style={th}>Method</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const itemIssues = issues.filter((issue) => issue.groupFile === group?.file && issue.resultIndex === i);
              const itemHasError = itemIssues.some((issue) => issue.level === 'error');
              const itemHasWarning = itemIssues.some((issue) => issue.level === 'warning');
              const check = checkResults?.[i];
              const nameMismatch = check?.status === 'mismatch';
              const mismatchMsg = getMismatchMessage(item, check, nameMismatch);
              const dotColor = getDotColor(itemHasError, itemHasWarning, nameMismatch);
              const dotTitle = getDotTitle(itemIssues, mismatchMsg);
              const resolvedName = resolvedNameOf(item, check, nlmByCode);
              const nlmResolvedName = check?.status === 'unknown-code' ? nlmByCode[item.loinc] : undefined;
              const chipSuggestions = getChipSuggestions(check, nlmSuggestions[i], unitRepairs[i]);
              const linkedName = resolvedName ?? nlmResolvedName;
              return (
                <Fragment key={`${item.loinc}-${i}`}>
                  <tr>
                    <td style={td}>
                      <StatusDot color={dotColor} title={dotTitle} />
                    </td>
                    <td style={td}>{item.analysis}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={item.loinc}
                          onChange={(e) => onEditItem(i, 'loinc', e.currentTarget.value)}
                          onBlur={() => {}}
                          style={{ ...cellInput, width: 80 }}
                        />
                        {linkedName && (
                          <a
                            href={`https://loinc.org/${item.loinc}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 13, color: COLOR.accent, whiteSpace: 'nowrap', textDecoration: 'none' }}
                          >
                            {linkedName}
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={item.rawValue || (item.value != null ? String(item.value) : '')}
                        onChange={(e) => onEditItem(i, 'value', e.currentTarget.value)}
                        onBlur={() => {}}
                        style={{ ...cellInput, width: 70 }}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={item.unit}
                        onChange={(e) => onEditItem(i, 'unit', e.currentTarget.value)}
                        onBlur={() => {}}
                        style={{ ...cellInput, width: 80 }}
                      />
                    </td>
                    <td style={td}>{referenceRangeOf(item)}</td>
                    <td style={td}>{item.method}</td>
                  </tr>
                  {!itemHasError && (itemHasWarning || nameMismatch) && (
                    <tr>
                      <td colSpan={7} style={{ ...td, paddingTop: 0, fontSize: 12, color: COLOR.statusWarnText }}>
                        {[
                          ...itemIssues.filter((issue) => issue.level === 'warning').map((issue) => issue.message),
                          ...(mismatchMsg ? [mismatchMsg] : []),
                        ].join(' · ')}
                      </td>
                    </tr>
                  )}
                  {chipSuggestions.length > 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...td, paddingTop: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {chipSuggestions.map((s) => {
                            const unitLabel = getUnitLabel(s, chipSuggestions);
                            return (
                              <span
                                key={s.loinc}
                                {...pressable(() => onEditItem(i, 'loinc', s.loinc))}
                                title={s.name}
                                style={{
                                  fontSize: 11,
                                  color: COLOR.accent,
                                  border: `1px solid ${COLOR.accent}`,
                                  borderRadius: 999,
                                  padding: '1px 8px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {s.loinc} {s.name}
                                {unitLabel}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {checkResults && unresolvedRows.length > 0 && nlmState !== 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: COLOR.textSecondary }}>
            {unresolvedRows.length} observation{pluralize(unresolvedRows.length)} unresolved —
          </span>
          <Button size="sm" onClick={crossCheck.onNlmCheck}>
            Check online (NLM)
          </Button>
          <span style={{ fontSize: 11, color: COLOR.textMuted }}>
            sends test names to clinicaltables.nlm.nih.gov, never values
          </span>
        </div>
      )}
      {nlmState === 'loading' && (
        <div style={{ fontSize: 12, color: COLOR.textSecondary, marginBottom: 16 }}>Checking against NLM…</div>
      )}
      {nlmState === 'failed' && (
        <div style={{ fontSize: 12, color: COLOR.statusBadText, marginBottom: 16 }}>
          NLM lookup failed — check your network and try again.
        </div>
      )}
      {(errorCount > 0 || warningCount > 0) && (
        <div style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 12 }}>
          {errorCount > 0 && (
            <span style={{ color: COLOR.statusBadText, fontWeight: 600 }}>
              {errorCount} error{pluralize(errorCount)}
            </span>
          )}
          {errorCount > 0 && warningCount > 0 && <span>, </span>}
          {warningCount > 0 && (
            <span style={{ color: COLOR.statusWarnText, fontWeight: 600 }}>
              {warningCount} warning{pluralize(warningCount)}
            </span>
          )}
        </div>
      )}
      {draftItems && (
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="primary" onClick={onSave} disabled={isSaving || hasErrors}>
            {saveButtonLabel(isSaving)}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </>
  );
}

export function DiagnosticReportDetailView({
  group,
  loadGroupItems,
  onBack,
  onUpdateGroup,
}: Readonly<{
  group: DiagnosticReport | undefined;
  loadGroupItems: (sessionId: string) => Promise<Result[]>;
  onBack: () => void;
  onUpdateGroup?: (file: string, updatedGroup: DiagnosticReport) => void;
}>) {
  const [loadedItems, setLoadedItems] = useState<Result[] | null>(null);
  const [draftItems, setDraftItems] = useState<Result[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const items = draftItems ?? group?.items ?? loadedItems;
  const crossCheck = useLoincCrossCheck(items, setDraftItems);

  // Validate what's on screen: the draft while editing, the stored group otherwise.
  const allGroups = useMemo<DiagnosticReport[]>(
    () => (group ? [{ ...group, items: items ?? group.items }] : []),
    [group, items]
  );
  const issues = useMemo(() => validateDiagnosticReports(allGroups), [allGroups]);
  const hasErrors = groupHasErrors(group?.file ?? '', issues);

  const errorCount = useMemo(
    () => issues.filter((i) => i.groupFile === group?.file && i.level === 'error').length,
    [issues, group?.file]
  );
  const warningCount = useMemo(
    () => issues.filter((i) => i.groupFile === group?.file && i.level === 'warning').length,
    [issues, group?.file]
  );

  useEffect(() => {
    if (!group || group.items) return;
    let cancelled = false;
    loadGroupItems(group.file).then((loaded) => {
      if (!cancelled) setLoadedItems(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [group, loadGroupItems]);

  const handleEditItem = (index: number, field: EditableField, newValue: string) => {
    if (!items) return;
    const updated = [...items];
    updated[index] = applyFieldEdit(updated[index]!, field, newValue);
    setDraftItems(updated);
  };

  const handleSave = async () => {
    if (!group || !draftItems || !onUpdateGroup) return;
    setIsSaving(true);
    try {
      onUpdateGroup(group.file, { ...group, items: draftItems });
      setDraftItems(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraftItems(null);
  };

  return (
    <>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
        <span {...pressable(onBack)} style={{ color: COLOR.accent, cursor: 'pointer' }}>
          ‹
        </span>
        {group ? `${group.place} · ${formatFullDate(group.date)}` : 'Diagnostic Report'}
      </h1>
      {!items || items.length === 0 ? (
        <EmptyState>No results recorded on this report.</EmptyState>
      ) : (
        <ReportResultsSection
          items={items}
          group={group}
          issues={issues}
          crossCheck={crossCheck}
          errorCount={errorCount}
          warningCount={warningCount}
          hasErrors={hasErrors}
          draftItems={draftItems}
          isSaving={isSaving}
          onEditItem={handleEditItem}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
