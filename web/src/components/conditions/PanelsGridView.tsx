import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { STATUS_STYLES, BADGE_WIDTH, BADGE_GAP, PANEL_PADDING, PANEL_GAP, PANEL_WIDTH, pressable } from './ui';
import { getStatus, type LatestByLoinc } from './resultsLookup';

export type Condition = { name: string; tests: Observation[] };

export function PanelsGridView({
  conditions,
  latestByLoinc,
  onOpenDetail,
  onOpenPopup,
}: Readonly<{
  conditions: Condition[];
  latestByLoinc: LatestByLoinc;
  onOpenDetail: (name: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
}>) {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Monitoring Panels</h1>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${PANEL_WIDTH}px)`, gap: PANEL_GAP }}>
        {conditions.map((condition) => (
          <div
            key={condition.name}
            style={{
              width: PANEL_WIDTH,
              border: '1.5px solid #1971c2',
              borderRadius: 16,
              padding: PANEL_PADDING,
              boxSizing: 'border-box',
            }}
          >
            <div
              {...pressable(() => onOpenDetail(condition.name))}
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                marginBottom: 16,
                cursor: 'pointer',
              }}
            >
              {condition.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BADGE_WIDTH}px)`, gap: BADGE_GAP }}>
              {condition.tests
                .filter((test) => !INDEX_LOINCS.has(test.loinc))
                .map((test) => {
                  const style = STATUS_STYLES[getStatus(latestByLoinc, testLoincs(test))];
                  return (
                    <div
                      key={test.loinc}
                      {...pressable((e) => onOpenPopup(test, e))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: BADGE_WIDTH,
                        height: 40,
                        border: `1.5px solid ${style.border}`,
                        background: style.background,
                        color: style.color,
                        borderRadius: 9999,
                        fontSize: 14,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                      }}
                    >
                      {test.short}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
