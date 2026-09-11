import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PageHeader } from './PageHeader';
import {
  BrainPituitaryIcon,
  CarrierIcon,
  HeartPulseIcon,
  HormoneIcon,
  ReceptorIcon,
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

function Enzyme({ label, node, children }: Readonly<{ label: string; node: string; children?: ReactNode }>) {
  return (
    <div className="mc-pathway-enzyme-col">
      <div className="mc-pathway-enzyme" data-node={node}>
        <img src="/pathways/enzyme.png" alt="" width={44} height={44} />
        <span className="mc-pathway-node-label">{label}</span>
      </div>
      {children && <div className="mc-pathway-product">{children}</div>}
    </div>
  );
}

function Receptor({ label, node }: Readonly<{ label: string; node: string }>) {
  return (
    <div className="mc-pathway-anchor mc-pathway-node" data-node={node}>
      <ReceptorIcon size={36} />
      <div className="mc-pathway-caption">
        <span className="mc-pathway-node-label">{label}</span>
      </div>
    </div>
  );
}

function TargetDiagram() {
  return (
    <div className="mc-pathway-row mc-pathway-row-start">
      <div className="mc-pathway-enzymes">
        <Enzyme label="5α-reductase" node="srd5a">
          <Hormone label="DHT" value="1.6 nmol/L" node="dht" />
        </Enzyme>
        <Enzyme label="aromatase" node="aromatase">
          <Hormone label="E2" value="38 pg/mL" node="e2" />
        </Enzyme>
        <div className="mc-pathway-er">
          <Receptor label="Estrogen receptor" node="er" />
        </div>
        <div className="mc-pathway-ar">
          <Receptor label="Androgen receptor" node="ar" />
        </div>
      </div>
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
      <div className="mc-pathway-e2blood">
        <Hormone label="E2" value="38 pg/mL" node="e2blood" />
      </div>
    </div>
  );
}

const PATHWAYS: ReadonlyArray<readonly [string, string, 'straight' | 'elbow' | 'drop']> = [
  ['lh', 'leydig', 'straight'],
  ['fsh', 'sertoli', 'straight'],
  ['leydig', 't', 'elbow'],
  ['aromatase', 'e2', 'straight'],
  ['srd5a', 'dht', 'straight'],
  ['e2', 'e2blood', 'elbow'],
  ['e2blood', 'er', 'drop'],
];

type Line = string;

function roundedPath(points: string, radius = 10): string {
  const pts = points.split(' ').map((p) => p.split(',').map(Number) as [number, number]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const ax = cx - ((cx - px) / inLen) * r;
    const ay = cy - ((cy - py) / inLen) * r;
    const bx = cx + ((nx - cx) / outLen) * r;
    const by = cy + ((ny - cy) / outLen) * r;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const last = pts.at(-1) ?? pts[0];
  return `${d} L${last[0]},${last[1]}`;
}

function PathwayArrows({ root }: Readonly<{ root: RefObject<HTMLDivElement | null> }>) {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const centerX = (r: DOMRect) => r.left + r.width / 2 - base.left;
      const fork = (from: string, targets: string[]): Line[] => {
        const a = el.querySelector(`[data-node="${from}"]`);
        const icons = targets.map((t) => el.querySelector(`[data-node="${t}"] img`)).filter((n): n is Element => n !== null);
        if (!a || icons.length === 0) return [];
        const x = centerX(a.getBoundingClientRect()) + 8;
        const y1 = (a.querySelector('.mc-pathway-caption') ?? a).getBoundingClientRect().bottom - base.top + 5;
        const rects = icons.map((i) => i.getBoundingClientRect());
        const junction = Math.min(...rects.map((r) => r.top)) - base.top - 28;
        return [
          `trunk:${x},${y1} ${x},${junction}`,
          ...rects.map((r) => `${x},${junction - 12} ${x},${junction} ${centerX(r)},${junction} ${centerX(r)},${r.top - base.top - 4}`),
        ];
      };
      const tNode = el.querySelector('[data-node="t"]');
      const enzymes = el.querySelector<HTMLElement>('.mc-pathway-enzymes');
      if (tNode && enzymes) {
        enzymes.style.transform = '';
        const imgs = [...enzymes.querySelectorAll('img')].map((i) => i.getBoundingClientRect());
        if (imgs.length === 2) {
          const mid = (centerX(imgs[0]) + centerX(imgs[1])) / 2;
          const containerLeft = enzymes.getBoundingClientRect().left - base.left;
          const ar = enzymes.querySelector<HTMLElement>('.mc-pathway-ar');
          if (ar) ar.style.left = `${mid - containerLeft - ar.offsetWidth / 2}px`;
          enzymes.style.transform = `translateX(${centerX(tNode.getBoundingClientRect()) + 8 - mid}px)`;
          const er = enzymes.querySelector<HTMLElement>('.mc-pathway-er');
          const e2 = el.querySelector('[data-node="e2"]');
          const e2blood = el.querySelector('[data-node="e2blood"]');
          if (er && e2 && e2blood) {
            const box = enzymes.getBoundingClientRect();
            const e2Rect = e2.getBoundingClientRect();
            er.style.left = `${centerX(e2blood.getBoundingClientRect()) + base.left + 48 - box.left}px`;
            er.style.top = `${e2Rect.top + e2Rect.height / 2 - box.top - er.offsetHeight / 2}px`;
          }
        }
      }
      const extra: Line[] = [];
      const trunkNode = el.querySelector('[data-node="t"]');
      const arNode = el.querySelector('[data-node="ar"]');
      const dhtNode = el.querySelector('[data-node="dht"]');
      if (trunkNode && arNode) {
        const x = centerX(trunkNode.getBoundingClientRect()) + 8;
        const arRect = arNode.getBoundingClientRect();
        const firstEnzyme = el.querySelector('[data-node="srd5a"] img');
        const junction = (firstEnzyme?.getBoundingClientRect().top ?? arRect.top) - base.top - 28;
        extra.push(`trunk:${x},${junction} ${x},${arRect.top - base.top - 4}`);
        extra.push(`${x},${arRect.top - base.top - 12} ${x},${arRect.top - base.top - 4}`);
        if (dhtNode) {
          const d = dhtNode.getBoundingClientRect();
          const dBottom = (dhtNode.querySelector('.mc-pathway-caption') ?? dhtNode).getBoundingClientRect().bottom - base.top + 5;
          const midY = arRect.top + arRect.height / 2 - base.top;
          const fromLeft = centerX(d) < centerX(arRect);
          const arEdge = fromLeft ? arRect.left - base.left - 4 : arRect.right - base.left + 4;
          extra.push(`${centerX(d)},${dBottom} ${centerX(d)},${midY} ${arEdge},${midY}`);
        }
      }
      setLines([
        ...extra,
        ...fork('t', ['aromatase', 'srd5a']),
        ...PATHWAYS.flatMap(([from, to, shape]) => {
          const a = el.querySelector(`[data-node="${from}"]`);
          const b = el.querySelector(`[data-node="${to}"]`);
          if (!a || !b) return [];
          const ra = (a.classList.contains('mc-pathway-enzyme') ? (a.querySelector('img') ?? a) : a).getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const bottomOf = (node: Element) => (node.querySelector('.mc-pathway-caption') ?? node).getBoundingClientRect().bottom - base.top + 5;
          const down = rb.top >= ra.top;
          const x2 = centerX(rb) - (shape === 'elbow' ? 8 : 0);
          const y2 = down ? rb.top - base.top - 4 : bottomOf(b);
          if (shape === 'elbow') {
            const midY = ra.top + ra.height / 2 - base.top;
            const inset = a.classList.contains('mc-pathway-slot') ? 18 : -4;
            const x1 = x2 >= centerX(ra) ? ra.right - base.left - inset : ra.left - base.left + inset;
            return [`${x1},${midY} ${x2},${midY} ${x2},${y2}`];
          }
          if (shape === 'drop') {
            const x = centerX(ra) + 8;
            const midY = rb.top + rb.height / 2 - base.top;
            const edge = x < centerX(rb) ? rb.left - base.left - 4 : rb.right - base.left + 4;
            return [`${x},${bottomOf(a)} ${x},${midY} ${edge},${midY}`];
          }
          return [`${centerX(ra)},${down ? bottomOf(a) : ra.top - base.top - 4} ${x2},${y2}`];
        }),
      ]);
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
      {lines.map((line) => {
        const trunk = line.startsWith('trunk:');
        return (
          <path
            key={line}
            d={roundedPath(trunk ? line.slice(6) : line)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinejoin="round"
            markerEnd={trunk ? undefined : 'url(#mc-pathway-head)'}
          />
        );
      })}
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
        {SITES.map(({ id, title, description }) => (
          <section key={id} className="mc-pathway-band" aria-label={title}>
            <div className="mc-pathway-site">
              <h2 className="mc-pathway-title" title={description}>{title}</h2>
            </div>
            <div className="mc-pathway-diagram">
              {id === 'cardio' && <CardioDiagram />}
              {id === 'testes' && <TestesDiagram />}
              {id === 'target' && <TargetDiagram />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
