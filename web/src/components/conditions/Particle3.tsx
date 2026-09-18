import type { ReactNode } from 'react';
import { CarrierIcon, CholesterolIcon, type IconComponent } from './customIcons';
import { SIZE, TRIGLYCERIDE_ART } from './pathwayShared';
import { Glyph } from './PathwayParts';

/** CarrierIcon's drawing spans ~42.6 of its 48-unit viewBox, so the box is enlarged to bring the drawing to molecular size. */
const CARGO_APO_SIZE = Math.round((SIZE.molecular * 48) / 42.6);
const CARGO_BUBBLE_SIZE = SIZE.molecular;
// The three VLDL_* values are tuned together for a ~75px bond length on every particle.
const VLDL_APO_DROP = 160;
const VLDL_CARGO_DROP = 51;
const VLDL_CARGO_GAP = 4;
const STACK_TRIG_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
const STACK_CHOL_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
const STACK_TRIG_ICON_SIZE = 27;
/** The cholesterol glyph reads smaller than TRIG's at the same size, so it runs bigger than its circle. */
const STACK_CHOL_ICON_SIZE = 34;

const TriglycerideGlyphIcon: IconComponent = ({ size = 48 }) => <Glyph art={{ ...TRIGLYCERIDE_ART, size }} alt="Triglyceride" />;

/** `labelOffset` nudges the caption sideways (px, positive = right) when the bond geometry leaves it off-center. */
function CargoAnchor({ children, label, labelOffset = 0 }: Readonly<{ children: ReactNode; label: string; labelOffset?: number }>) {
  return (
    <div className="mc-pathway-anchor" style={{ height: CARGO_APO_SIZE, alignItems: 'center' }}>
      {children}
      <div className="mc-pathway-caption" style={labelOffset ? { transform: `translateX(calc(-50% + ${labelOffset}px))` } : undefined}>
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

/** The circle count, not the icon's size, depicts how much of a compound is aboard, so "more" never reads as "bigger". */
function CompoundStack({
  dataNode,
  count,
  circleSize,
  iconSize,
  icon: Icon,
  label,
  labelOffset = 0,
  overlap = 0,
}: Readonly<{
  dataNode: string;
  count: number;
  circleSize: number;
  iconSize: number;
  icon: IconComponent;
  label: string;
  labelOffset?: number;
  /** When set (px), circles cascade diagonally and partly cover each other instead of stacking edge to edge. */
  overlap?: number;
}>) {
  const cascadeSpan = overlap * (count - 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        data-node={dataNode}
        style={
          overlap
            ? { position: 'relative', width: circleSize + cascadeSpan, height: circleSize + cascadeSpan }
            : { display: 'flex', flexDirection: 'column', gap: 3 }
        }
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="mc-pathway-bubble"
            style={
              overlap
                ? { position: 'absolute', left: i * overlap, top: i * overlap, width: circleSize, height: circleSize, zIndex: i }
                : { width: circleSize, height: circleSize }
            }
          >
            {/* Only the frontmost cascaded circle draws its icon; the ones behind would show through as clutter. */}
            {(!overlap || i === count - 1) && <Icon size={iconSize} />}
          </span>
        ))}
      </div>
      <span className="mc-pathway-node-label" style={{ marginTop: 6, display: 'inline-block', transform: labelOffset ? `translateX(${labelOffset}px)` : undefined }}>
        {label}
      </span>
    </div>
  );
}

/** A holder apoprotein bonded to a Chol stack and a TRIG stack; every particle carries at least one of each. */
export function ParticleNode({
  id,
  label,
  holder = 'ApoB-100',
  extraApo,
  trigCount,
  cholCount,
  trigOverlap = 0,
}: Readonly<{
  id: string;
  label: string;
  /** The structural apolipoprotein: ApoB-100, ApoB-48 (chylomicron) or ApoA-I (HDL). */
  holder?: string;
  /** A second protein, e.g. Lp(a)'s apo(a), drawn as a small pill on the holder icon. */
  extraApo?: string;
  trigCount: number;
  cholCount: number;
  trigOverlap?: number;
}>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} data-node={id}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CompoundStack
            dataNode={`${id}-trig`}
            count={trigCount}
            circleSize={STACK_TRIG_CIRCLE_SIZE}
            iconSize={STACK_TRIG_ICON_SIZE}
            icon={TriglycerideGlyphIcon}
            label="TRIG"
            labelOffset={-5}
            overlap={trigOverlap}
          />
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_APO_DROP }}>
          <CargoAnchor label={holder}>
            <span data-node={`${id}-apo`} style={extraApo ? { position: 'relative' } : undefined}>
              <CarrierIcon size={CARGO_APO_SIZE} />
              {extraApo && (
                <span className="mc-lipid-extra-apo" title={extraApo}>
                  <CarrierIcon size={Math.round(CARGO_APO_SIZE * 0.55)} />
                  <span className="mc-lipid-extra-apo-label">(a)</span>
                </span>
              )}
            </span>
          </CargoAnchor>
        </div>
        <span style={{ width: VLDL_CARGO_GAP }} />
        <div style={{ marginTop: VLDL_CARGO_DROP }}>
          <CompoundStack
            dataNode={`${id}-chol`}
            count={cholCount}
            circleSize={STACK_CHOL_CIRCLE_SIZE}
            iconSize={STACK_CHOL_ICON_SIZE}
            icon={CholesterolIcon}
            label="Chol"
            labelOffset={5}
            overlap={4}
          />
        </div>
      </div>
      <span className="mc-pathway-node-label" style={{ marginTop: 8 }}>{label}</span>
    </div>
  );
}
