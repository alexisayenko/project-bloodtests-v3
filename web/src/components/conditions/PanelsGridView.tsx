import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { STATUS_STYLES, PANEL_PADDING, PANEL_GAP, PANEL_WIDTH, pressable } from './ui';
import { getStatus, type LatestByLoinc } from './resultsLookup';

export type Condition = { name: string; tests: Observation[] };

// Status is conveyed by a small colored dot next to the label instead of a
// filled/bordered pill, so the label text stays legible dark text even for a
// 'never' (no result on file) status -- a pill's `STATUS_STYLES['never']`
// (grey border+background+text) could wash out to near-invisible against
// the card's white background.
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
              padding: PANEL_PADDING,
              boxSizing: 'border-box',
            }}
          >
            <div
              {...pressable(() => onOpenDetail(condition.name))}
              style={{
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.04em',
                paddingBottom: 10,
                marginBottom: 16,
                borderBottom: '1.5px solid #1971c2',
                cursor: 'pointer',
              }}
            >
              {condition.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 8, rowGap: 4 }}>
              {condition.tests
                .filter((test) => !INDEX_LOINCS.has(test.loinc))
                .map((test) => {
                  const style = STATUS_STYLES[getStatus(latestByLoinc, testLoincs(test))];
                  return (
                    <div
                      key={test.loinc}
                      {...pressable((e) => onOpenPopup(test, e))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 0',
                        borderBottom: '1px solid #eee',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: style.border,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: '#1a1a1a', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {test.short}
                      </span>
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
