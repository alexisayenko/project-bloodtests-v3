import type { CSSProperties, ReactNode } from 'react';
import { ALSO_REFS, ANALYTE_BY_LOINC, SHORT_NAMES } from '../../../data/analyteCatalog';
import { COLOR, RADIUS } from '../../../styles/tokens';
import { Card } from '../../primitives';
import type { Observation } from '../markers';
import { pressable } from '../ui';

const SOURCES_RETRIEVED = '2026-09-11';

type OpenPopup = (test: Observation, e: { currentTarget: HTMLElement }) => void;

const TOTAL_T = '14913-8';
const FREE_T = '2991-8';
const SHBG = '2942-1';
const ALBUMIN = '1751-7';
const LH = '10501-5';
const FSH = '15067-2';
const ESTRADIOL = '2243-4';
const DHT = '1848-1';

function observationFor(code: string): Observation {
  const a = ANALYTE_BY_LOINC[code];
  const friendlyName = a?.friendlyName ?? code;
  return {
    shortName: SHORT_NAMES[code]?.shortName ?? friendlyName,
    friendlyName,
    longCommonName: a?.longCommonName ?? '',
    loinc: code,
    unit: a?.unit,
    also: ALSO_REFS[code],
  };
}

function AnalyteName({
  code,
  onOpenPopup,
  children,
}: Readonly<{ code: string; onOpenPopup?: OpenPopup; children: ReactNode }>) {
  if (!onOpenPopup) return <>{children}</>;
  return (
    <span
      {...pressable((e) => onOpenPopup(observationFor(code), e))}
      style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
    >
      {children}
    </span>
  );
}

type SourceId = 'endotext' | 'statpearls-testosterone' | 'statpearls-clomiphene' | 'huijben-2022';

interface Source {
  id: SourceId;
  organization: string;
  document: string;
  url: string;
  detail?: string;
  quotes: string[];
}

const SOURCES: Source[] = [
  {
    id: 'endotext',
    organization: 'Endotext (NCBI Bookshelf)',
    document: 'Androgen Physiology, Pharmacology, Use and Misuse',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK279000/',
    detail: 'Handelsman DJ · last update October 5, 2020',
    quotes: [
      'Under physiologic conditions, 60% to 70% of circulating testosterone is SHBG bound with the remainder bound to lower affinity, high-capacity binding sites (albumin, α1 acid glycoprotein, corticosteroid binding protein) and 1% to 2% remaining non-protein bound.',
      'Similarly, another derived testosterone measure, bioavailable testosterone, is defined as the non-SHBG bound testosterone (in effect the combination of albumin-bound plus unbound testosterone) and can also be measured directly or calculated by a formula from total testosterone and SHBG and albumin measurements.',
      'DHT has higher binding affinity to … and 3-10 time greater molar potency in transactivation … of the androgen receptor relative to testosterone.',
      'The diversification pathway, characteristic of bone and brain, involves the conversion of testosterone to estradiol by the enzyme aromatase which then interacts with the ERs α and/or β.',
      'Such negative feedback involves both testosterone effects via androgen receptors as well as aromatization to estradiol within the hypothalamus …',
    ],
  },
  {
    id: 'statpearls-testosterone',
    organization: 'StatPearls (NCBI Bookshelf)',
    document: 'Physiology, Testosterone',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK526128/',
    detail: 'Nassar GN, Leslie SW · last update April 19, 2026',
    quotes: [
      'Leydig cells in the testes produce testosterone from cholesterol.',
      'Most testosterone circulates bound to plasma proteins, such as sex hormone-binding globulin and albumin.',
    ],
  },
  {
    id: 'statpearls-clomiphene',
    organization: 'StatPearls (NCBI Bookshelf)',
    document: 'Clomiphene',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK559292/',
    detail: 'Mbi Feh MK, Patel P, Wadhwa R · last update January 11, 2024',
    quotes: [
      'Clomiphene is a selective estrogen receptor modulator (SERM).',
      'Clomiphene also acts as a partial estrogen agonist in the hypothalamus, resulting in a negative estrogenic feedback inhibition, thus increasing gonadotropins.',
    ],
  },
  {
    id: 'huijben-2022',
    organization: 'Andrology (systematic review and meta-analysis)',
    document: 'Clomiphene citrate for men with hypogonadism: a systematic review and meta-analysis',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34933414/',
    detail: 'Huijben M et al., 2022 · doi:10.1111/andr.13146 · abstract',
    quotes: [
      'Total testosterone increased with 2.60 (95% CI 1.82-3.38) during clomiphene citrate treatment. An increase was also seen in free testosterone, luteinizing hormone, follicle stimulating hormone, sex hormone-binding globulin and estradiol.',
    ],
  },
];

const sourceAnchor = (id: SourceId) => `testosterone-source-${id}`;
const sourceNumber = (id: SourceId) => SOURCES.findIndex((s) => s.id === id) + 1;

function Ref({ to }: Readonly<{ to: SourceId }>) {
  const anchor = sourceAnchor(to);
  return (
    <sup style={{ fontSize: '0.7em', fontWeight: 600, fontStyle: 'normal', marginLeft: 1 }}>
      <a
        href={`#${anchor}`}
        onClick={(e) => {
          // The app routes on the URL hash, so an in-page jump must not rewrite it.
          e.preventDefault();
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        style={{ color: COLOR.accent, textDecoration: 'none' }}
      >
        [{sourceNumber(to)}]
      </a>
    </sup>
  );
}

const H2: CSSProperties = { fontSize: 17, fontWeight: 600, margin: '28px 0 8px' };
const PROSE: CSSProperties = { fontSize: 14, color: COLOR.text, lineHeight: 1.55, margin: '0 0 12px' };
const FLOW_BOX: CSSProperties = {
  background: COLOR.surfaceMuted,
  borderRadius: 8,
  padding: '14px 16px',
  overflowX: 'auto',
};

type NodeKind = 'hormone' | 'site' | 'enzyme' | 'receptor' | 'drug';

const NODE_PALETTE: Record<NodeKind, CSSProperties> = {
  hormone: { background: COLOR.surfaceCard, color: COLOR.text, border: `1px solid ${COLOR.border}`, fontWeight: 600 },
  site: { background: COLOR.surfaceCard, color: COLOR.textSecondary, border: `1px dashed ${COLOR.border}` },
  enzyme: { background: COLOR.accentSoft, color: COLOR.accent, border: `1px solid ${COLOR.accentLine}`, fontStyle: 'italic' },
  receptor: { background: COLOR.statusOkBg, color: COLOR.statusOkText, border: `1px solid ${COLOR.borderSubtle}`, fontWeight: 600 },
  drug: { background: COLOR.statusWarnBg, color: COLOR.statusWarnText, border: `1px solid ${COLOR.borderSubtle}`, fontWeight: 600 },
};

function Node({ kind, children, note }: Readonly<{ kind: NodeKind; children: ReactNode; note?: ReactNode }>) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: RADIUS.control,
        fontSize: 13,
        whiteSpace: 'nowrap',
        ...NODE_PALETTE[kind],
      }}
    >
      {children}
      {note && <span style={{ fontSize: 11.5, fontWeight: 400, fontStyle: 'normal', opacity: 0.85 }}>{note}</span>}
    </span>
  );
}

function Arrow({ symbol = '→', label, inhibit }: Readonly<{ symbol?: string; label?: string; inhibit?: boolean }>) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: '0 8px', flexShrink: 0 }}>
      {label && <span style={{ fontSize: 11.5, color: COLOR.textMuted, whiteSpace: 'nowrap' }}>{label}</span>}
      <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: inhibit ? COLOR.statusBad : COLOR.accent }}>
        {symbol}
      </span>
    </span>
  );
}

function FlowRow({ children, style }: Readonly<{ children: ReactNode; style?: CSSProperties }>) {
  return <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content', ...style }}>{children}</div>;
}

function Change({ up, children }: Readonly<{ up: boolean; children: ReactNode }>) {
  return (
    <span style={{ fontWeight: 600 }}>
      <span style={{ color: COLOR.accent, fontWeight: 700 }}>{up ? '↑' : '↓'}</span>
      {children}
    </span>
  );
}

type Availability = 'bioavailable' | 'not bioavailable';

function FractionCard({
  title,
  share,
  shareNote,
  offRate,
  availability,
}: Readonly<{
  title: ReactNode;
  share: ReactNode;
  shareNote?: string;
  offRate?: string;
  availability: Availability;
}>) {
  const available = availability === 'bioavailable';
  return (
    <Card padding="14px 16px" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLOR.text }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: COLOR.navy, margin: '4px 0 2px' }}>{share}</div>
      {shareNote && <div style={{ fontSize: 13, color: COLOR.textSecondary }}>{shareNote}</div>}
      <div style={{ fontSize: 13, color: COLOR.textSecondary, minHeight: 20 }}>{offRate ?? ' '}</div>
      <span
        style={{
          display: 'inline-block',
          marginTop: 8,
          padding: '2px 10px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          background: available ? COLOR.statusOkBg : COLOR.statusBadBg,
          color: available ? COLOR.statusOkText : COLOR.statusBadText,
        }}
      >
        {availability}
      </span>
    </Card>
  );
}

function SourceItem({ source }: Readonly<{ source: Source }>) {
  return (
    <div id={sourceAnchor(source.id)} style={{ marginBottom: 18, scrollMarginTop: 80 }}>
      <div style={{ fontSize: 14, color: COLOR.text }}>
        <span style={{ fontWeight: 600, color: COLOR.accent }}>[{sourceNumber(source.id)}]</span>{' '}
        <span style={{ fontWeight: 600 }}>{source.organization}</span>
        {' — '}
        <a href={source.url} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>
          {source.document}
        </a>
        {source.detail && <span style={{ color: COLOR.textMuted, fontSize: 13 }}> · {source.detail}</span>}
      </div>
      {source.quotes.map((quote) => (
        <blockquote
          key={quote}
          style={{
            margin: '8px 0 0',
            padding: '8px 14px',
            borderLeft: `3px solid ${COLOR.accent}`,
            background: COLOR.surfaceMuted,
            borderRadius: '0 8px 8px 0',
            fontSize: 13,
            color: COLOR.textSecondary,
            fontStyle: 'italic',
          }}
        >
          {quote}
        </blockquote>
      ))}
    </div>
  );
}

export function TestosteronePage({ onOpenPopup }: Readonly<{ onOpenPopup?: OpenPopup }>) {
  const name = (code: string, label: ReactNode) => (
    <AnalyteName code={code} onOpenPopup={onOpenPopup}>
      {label}
    </AnalyteName>
  );
  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Testosterone: from Leydig cell to receptor</h1>
      <div style={{ color: COLOR.textMuted, fontSize: 14, marginBottom: 8 }}>
        Where testosterone is made, how it travels in plasma, what the target cell turns it into, the loop that
        regulates it — and what clomiphene does to that loop.
      </div>

      <h2 style={H2}>1. Secretion</h2>
      <div style={FLOW_BOX}>
        <FlowRow>
          <Node kind="site" note="testes">
            <span>
              Leydig cells
              <Ref to="statpearls-testosterone" />
            </span>
          </Node>
          <Arrow label="secrete" />
          <Node kind="hormone">{name(TOTAL_T, 'Testosterone (T)')}</Node>
          <Arrow label="diffuses" />
          <Node kind="site">Bloodstream</Node>
        </FlowRow>
      </div>

      <h2 style={H2}>2. Transport in plasma</h2>
      <p style={PROSE}>
        In plasma, testosterone sits in an equilibrium between three states — no trigger is needed to move it between
        them. What decides whether a fraction can reach tissue is how quickly it comes off its carrier.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <FractionCard
          title={<>{name(SHBG, 'SHBG')}-bound</>}
          share={
            <>
              60–70%
              <Ref to="endotext" />
            </>
          }
          offRate="Slow off-rate"
          availability="not bioavailable"
        />
        <FractionCard
          title={<>{name(ALBUMIN, 'Albumin')}-bound</>}
          share={
            <>
              The remainder
              <Ref to="endotext" />
            </>
          }
          shareNote="with other low-affinity binders"
          offRate="Fast off-rate"
          availability="bioavailable"
        />
        <FractionCard
          title={name(FREE_T, 'Free')}
          share={
            <>
              1–2%
              <Ref to="endotext" />
            </>
          }
          availability="bioavailable"
        />
      </div>
      <div
        style={{
          ...FLOW_BOX,
          marginTop: 12,
          fontSize: 14,
          textAlign: 'center',
          color: COLOR.text,
        }}
      >
        <b>Bioavailable T</b> <span style={{ color: COLOR.accent, fontWeight: 700 }}>=</span> {name(FREE_T, 'free T')}{' '}
        <span style={{ color: COLOR.accent, fontWeight: 700 }}>+</span> {name(ALBUMIN, 'albumin')}-bound T
        <Ref to="endotext" />
      </div>

      <h2 style={H2}>3. In the target cell</h2>
      <p style={PROSE}>Once inside a cell, testosterone takes one of three routes.</p>
      <div style={{ ...FLOW_BOX, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FlowRow>
          <Node kind="hormone">{name(TOTAL_T, 'T')}</Node>
          <Arrow />
          <Node kind="enzyme">5α-reductase</Node>
          <Arrow />
          <Node
            kind="hormone"
            note={
              <>
                3–10× more potent at the AR
                <Ref to="endotext" />
              </>
            }
          >
            {name(DHT, 'DHT')}
          </Node>
          <Arrow />
          <Node kind="receptor">Androgen receptor (AR)</Node>
        </FlowRow>
        <FlowRow>
          <Node kind="hormone">{name(TOTAL_T, 'T')}</Node>
          <Arrow />
          <Node kind="enzyme">aromatase</Node>
          <Arrow />
          <Node kind="hormone">{name(ESTRADIOL, 'Estradiol (E2)')}</Node>
          <Arrow />
          <Node kind="receptor">Estrogen receptors (ER-α / ER-β)</Node>
        </FlowRow>
        <FlowRow>
          <Node kind="hormone">{name(TOTAL_T, 'T')}</Node>
          <Arrow label="directly" />
          <Node kind="receptor">Androgen receptor (AR)</Node>
        </FlowRow>
      </div>

      <h2 style={H2}>4. Negative feedback</h2>
      <p style={PROSE}>
        Both testosterone and estradiol tell the brain there is enough; the signal travels back down to the Leydig
        cells, closing the loop.
      </p>
      <div style={FLOW_BOX}>
        <FlowRow>
          <Node kind="hormone">
            <span>
              {name(TOTAL_T, 'T')} and {name(ESTRADIOL, 'E2')}
            </span>
          </Node>
          <Arrow symbol="⊣" label="inhibit" inhibit />
          <Node kind="site" note="GnRH">Hypothalamus</Node>
          <Arrow />
          <Node
            kind="site"
            note={
              <>
                {name(LH, 'LH')}, {name(FSH, 'FSH')}
              </>
            }
          >
            Pituitary
          </Node>
          <Arrow />
          <Node kind="site">Leydig cells</Node>
          <Arrow />
          <Node kind="hormone">{name(TOTAL_T, 'T')}</Node>
          <Arrow symbol="⟲" />
        </FlowRow>
      </div>

      <h2 style={H2}>Clomiphene (SERM)</h2>
      <p style={PROSE}>
        Clomiphene is a selective estrogen receptor modulator (SERM).
        <Ref to="statpearls-clomiphene" /> It does not add testosterone; it changes how the hypothalamus reads
        estradiol&apos;s feedback, so the loop drives the testes harder.
      </p>
      <div style={FLOW_BOX}>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14, lineHeight: 1.9, color: COLOR.text }}>
          <li>
            <Node kind="drug">Clomiphene</Node> acts as a partial estrogen agonist in the hypothalamus
            <Ref to="statpearls-clomiphene" />
          </li>
          <li>
            Estrogenic feedback now drives gonadotropins up
            <Ref to="statpearls-clomiphene" />
          </li>
          <li>
            <Change up>{name(LH, 'LH')}</Change>, <Change up>{name(FSH, 'FSH')}</Change>
            <Ref to="huijben-2022" />
          </li>
          <li>
            <Change up>{name(TOTAL_T, 'T')}</Change>
            <Ref to="huijben-2022" />
          </li>
          <li>
            <Change up>{name(ESTRADIOL, 'E2')}</Change>
            <Ref to="huijben-2022" /> too — testosterone is the substrate aromatase converts to estradiol
            <Ref to="endotext" />
          </li>
        </ol>
      </div>

      <h2 style={{ ...H2, marginBottom: 10 }}>Sources</h2>
      <div style={{ fontSize: 13, color: COLOR.textMuted, marginBottom: 12 }}>
        Quoted verbatim; each retrieved {SOURCES_RETRIEVED}. An ellipsis marks a dropped in-text citation number.
      </div>
      {SOURCES.map((source) => (
        <SourceItem key={source.url} source={source} />
      ))}
    </div>
  );
}
