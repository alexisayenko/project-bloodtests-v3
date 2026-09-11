import { useEffect, useRef, useState, type RefObject } from 'react';
import { PageHeader } from './PageHeader';
import {
  BrainPituitaryIcon,
  CarrierIcon,
  HeartPulseIcon,
  HormoneIcon,
  TargetTissueIcon,
  TestesIcon,
  type IconComponent,
} from './customIcons';

interface PathwaySite {
  id: string;
  title: string;
  description: string;
  Icon: IconComponent;
}

const SITES: PathwaySite[] = [
  { id: 'hp', title: 'Hypothalamus + Pituitary', description: 'Regulate and release hormones', Icon: BrainPituitaryIcon },
  { id: 'cardio', title: 'Blood Transport', description: 'Carries hormones; proteins bind and transport them', Icon: HeartPulseIcon },
  { id: 'testes', title: 'Testes', description: 'Produce sex steroids', Icon: TestesIcon },
  { id: 'target', title: 'Target tissues', description: 'Where hormones exert their effects', Icon: TargetTissueIcon },
];

const CARRIER_SIZE = 73;

interface DockedCarrier {
  label: string;
  value: string;
  boundLabel: string;
  boundValue: string;
  boundSide: 'left' | 'right';
}

const SHBG: DockedCarrier = { label: 'SHBG', value: '35 nmol/L', boundLabel: 'SHBG-bound T', boundValue: '7.6 nmol/L', boundSide: 'right' };
const ALBUMIN: DockedCarrier = { label: 'Albumin', value: '4.4 g/dL', boundLabel: 'Albumin-bound T', boundValue: '8.1 nmol/L', boundSide: 'left' };

function Carrier({ carrier }: Readonly<{ carrier: DockedCarrier }>) {
  const protein = (
    <div className="mc-pathway-anchor">
      <CarrierIcon size={CARRIER_SIZE} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{carrier.label}</span>
        <span className="mc-pathway-node-value">{carrier.value}</span>
      </div>
    </div>
  );
  const bound = (
    <div className="mc-pathway-anchor" style={{ height: CARRIER_SIZE, alignItems: 'center' }}>
      <span className="mc-pathway-bubble">
        <HormoneIcon size={24} />
      </span>
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{carrier.boundLabel}</span>
        <span className="mc-pathway-node-value">{carrier.boundValue}</span>
      </div>
    </div>
  );
  const right = carrier.boundSide === 'right';
  return (
    <div className={right ? 'mc-pathway-docked' : 'mc-pathway-docked mc-pathway-docked-left'}>
      {right ? protein : bound}
      <span className="mc-pathway-bond" />
      {right ? bound : protein}
    </div>
  );
}

function Exchange() {
  return (
    <svg className="mc-pathway-exchange" viewBox="0 0 100 14" preserveAspectRatio="none" aria-label="exchanges with" role="img">
      <path d="M2 4H98M92 1l6 3" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <path d="M98 10H2M8 13l-6-3" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

function Hormone({ label, value, node, slot }: Readonly<{ label: string; value: string; node?: string; slot?: boolean }>) {
  return (
    <div className={slot ? 'mc-pathway-anchor mc-pathway-node mc-pathway-slot' : 'mc-pathway-anchor mc-pathway-node'} data-node={node}>
      <HormoneIcon size={39} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
        <span className="mc-pathway-node-value">{value}</span>
      </div>
    </div>
  );
}

function Cells({ label, node }: Readonly<{ label: string; node: string }>) {
  return (
    <div className="mc-pathway-anchor mc-pathway-node mc-pathway-slot" data-node={node}>
      <img src="/pathways/leydig-cells.png" alt="" width={56} height={56} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

function TestesDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <Cells label="Sertoli Cells" node="sertoli" />
      <Cells label="Leydig Cells" node="leydig" />
    </div>
  );
}

function CardioDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <Hormone label="FSH" value="4.1 IU/L" node="fsh" slot />
      <Hormone label="LH" value="5.2 IU/L" node="lh" slot />
      <div className="mc-pathway-group">
        <Carrier carrier={SHBG} />
        <Exchange />
        <Hormone label="T" value="0.32 nmol/L" node="t" />
        <Exchange />
        <Carrier carrier={ALBUMIN} />
      </div>
    </div>
  );
}

const PATHWAYS: ReadonlyArray<readonly [string, string, 'straight' | 'elbow']> = [
  ['lh', 'leydig', 'straight'],
  ['fsh', 'sertoli', 'straight'],
  ['leydig', 't', 'elbow'],
];

type Line = string;

function PathwayArrows({ root }: Readonly<{ root: RefObject<HTMLDivElement | null> }>) {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const centerX = (r: DOMRect) => r.left + r.width / 2 - base.left;
      setLines(
        PATHWAYS.flatMap(([from, to, shape]) => {
          const a = el.querySelector(`[data-node="${from}"]`);
          const b = el.querySelector(`[data-node="${to}"]`);
          if (!a || !b) return [];
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const bottomOf = (node: Element) => (node.querySelector('.mc-pathway-caption') ?? node).getBoundingClientRect().bottom - base.top + 1;
          const down = rb.top >= ra.top;
          const x2 = centerX(rb);
          const y2 = down ? rb.top - base.top - 4 : bottomOf(b);
          if (shape === 'elbow') {
            const midY = ra.top + ra.height / 2 - base.top;
            const x1 = x2 >= centerX(ra) ? ra.right - base.left - 18 : ra.left - base.left + 18;
            return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
          }
          return [`${centerX(ra)},${down ? bottomOf(a) : ra.top - base.top - 4} ${x2},${y2}`];
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  return (
    <svg className="mc-pathway-overlay" aria-hidden="true">
      <defs>
        <marker id="mc-pathway-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
      </defs>
      {lines.map((points) => (
        <polyline key={points} points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" markerEnd="url(#mc-pathway-head)" />
      ))}
    </svg>
  );
}

export function HormonalPathwaysView() {
  const bandsRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <PageHeader
        overline="Endocrinology"
        titlePrimary="Hormonal"
        titleAccent="Pathways"
        description={['Biochemical pathways of hormones']}
      />
      <div className="mc-pathway-bands" ref={bandsRef}>
        <PathwayArrows root={bandsRef} />
        {SITES.map(({ id, title, description, Icon }) => (
          <section key={id} className="mc-pathway-band" aria-label={title}>
            <div className="mc-pathway-site">
              <h2 className="mc-pathway-title">{title}</h2>
              <span className="mc-pathway-icon">
                <Icon size={28} />
              </span>
              <p className="mc-pathway-desc">{description}</p>
            </div>
            <div className="mc-pathway-diagram">
              {id === 'cardio' && <CardioDiagram />}
              {id === 'testes' && <TestesDiagram />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
