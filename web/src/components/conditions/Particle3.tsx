import type { ReactNode } from 'react';
import { CarrierIcon, CholesterolIcon, type IconComponent } from './customIcons';
import { SIZE, type GlyphArt } from './pathwayShared';
import { Glyph } from './PathwayParts';

/** ApoB-100's own drawing spans ~42.6 of its 48-unit viewBox (HormonalPathwaysView's CARRIER_SIZE), so its box is enlarged to bring the drawing itself to molecular-actor size. */
const CARGO_APO_SIZE = Math.round((SIZE.molecular * 48) / 42.6);
const CARGO_BUBBLE_SIZE = SIZE.molecular;
/**
 * Every bond line in this chain (TRIG-ApoB and Chol-ApoB) is tuned to the
 * same ~75px length, so the chain reads as one consistent unit of "distance
 * a bond spans" rather than particle-specific line lengths.
 */
/** How far ApoB-100 drops below TRIG/Chol, so the two bonds meet it at a sharp angle. IDL/LDL drop the same amount to line up with it, since they're the same particle further down the chain. */
const VLDL_APO_DROP = 160;
/** TRIG and Chol also drop partway down their own bond lines, toward ApoB-100, so the V reads as a shorter, tighter shape rather than spanning the full height. Tuned together with VLDL_CARGO_GAP for a ~75px bond length. */
const VLDL_CARGO_DROP = 51;
/** Horizontal gap either side of ApoB-100, tuned together with VLDL_CARGO_DROP. */
const VLDL_CARGO_GAP = 4;
/**
 * Circle size for each compound's individual unit-bubble in a stack (below) --
 * the same 32px diameter as `CARGO_BUBBLE_SIZE` and as `BUBBLE_SIZE`
 * (`SIZE.molecular`) on Hormonal Pathways' own docked bubbles, so a bubble
 * reads as the same size everywhere it appears on either page.
 */
const STACK_TRIG_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
const STACK_CHOL_CIRCLE_SIZE = CARGO_BUBBLE_SIZE;
/** Scaled up from Hormonal Pathways' DOCKED_SIZE (21, sized for a 25px stack circle) to keep the same fill ratio now the circle itself is bigger (32px, matching Hormonal Pathways' own bubble diameter). */
const STACK_TRIG_ICON_SIZE = 27;
/** The cholesterol glyph's own drawing reads smaller than TRIG's at the same size, so its icon runs bigger than its own circle to fill it as fully -- scaled up together with STACK_CHOL_CIRCLE_SIZE to keep the same proportion. */
const STACK_CHOL_ICON_SIZE = 34;
/**
 * TRIG: 3 for VLDL, 2 for IDL (shed via lipoprotein lipase), 1 for LDL
 * (essentially none left), 4 for chylomicron (the fattiest particle). Chol:
 * 3 for VLDL, 2 for IDL, 1 for LDL/chylomicron/HDL/Lp(a). Illustrative
 * counts, not to scale: the sourced data (lipoprotein-particles.json) only
 * gives % of each particle's own mass, and IDL's isn't sourced at all.
 */

/** Triglyceride glyph, cropped to its non-transparent bounding box the way LIVER_ART is. `size` is overridden per call site by TriglycerideGlyphIcon below, since Glyph bakes its render size into the art object. Exported for LipidTransportView's own standalone TRIG glyphs (the liver's and enterocytes' own triglyceride synthesis), which sit outside any particle. */
export const TRIGLYCERIDE_ART: GlyphArt = { src: '/pathways/triglyceride.png?v=1', width: 675, height: 449, box: [6, 6, 669, 443], size: SIZE.molecular };
/** Adapts TRIGLYCERIDE_ART to the `IconComponent` shape `CompoundStack`'s `icon` prop expects, so the raster glyph can stand in for the hand-drawn `TriglycerideIcon` there. */
const TriglycerideGlyphIcon: IconComponent = ({ size = 48 }) => <Glyph art={{ ...TRIGLYCERIDE_ART, size }} alt="Triglyceride" />;

/** A cargo diagram's own anchor: an icon (or docked bubble) with a caption below it, sized to line up with the apoprotein's own height. `labelOffset` nudges the caption sideways (px, positive = right) when the bond geometry leaves it looking off-center. */
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

/** A vertical stack of identical small bubbles: how many circles is how much of that compound is aboard, not one bigger blob -- a discrete count rather than a scaled size, so "more" never looks like "bigger". */
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
            {/* Cascaded circles overlap, so only the frontmost (topmost z-index) one draws its icon -- the ones behind it are bare discs, otherwise their icons show through as visual clutter. The count still depicts the amount; only which layer carries the icon changes. */}
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

/**
 * One stage of the endogenous chain, drawn as a holder-plus-cargo row:
 * the holder apoprotein carries its own stack of Chol circles and a stack
 * of TRIG circles, bonded to it at the same sharp angle VLDL uses. Every
 * particle rendered here still carries at least one TRIG circle (down to 1
 * for LDL/HDL/Lp(a)), so there is no bare-Chol-only variant to draw.
 */
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
  /** The particle's structural apolipoprotein -- ApoB-100 for the endogenous chain, ApoB-48 for chylomicron, ApoA-I for HDL. */
  holder?: string;
  /** Lp(a) carries a second protein, apo(a), disulfide-linked to its ApoB-100 -- drawn as a small pill hanging off the holder icon. */
  extraApo?: string;
  /** At least 1 for every particle rendered here -- see the note above ParticleNode. */
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
