import {
  Mars,
  Wind,
  Heart,
  Activity,
  Droplets,
  Bone,
  Pill,
  Microscope,
  type LucideIcon,
} from 'lucide-react';
import { LiverIcon, KidneyIcon, ThyroidIcon, type IconComponent } from './customIcons';
import { TINT } from '../../styles/tokens';

/** Per-panel visual identity: accent color, card background tint, icon circle background, border color, icon, and short description. */
export type PanelMeta = {
  color: string;
  bgColor: string;
  iconBg: string;
  borderColor: string;
  icon: LucideIcon | IconComponent;
  description: string;
};

type Tint = { ink: string; bg: string; icon: string; line: string };

const colors = ({ ink, bg, icon, line }: Tint) => ({ color: ink, bgColor: bg, iconBg: icon, borderColor: line });

const DEFAULT_META: PanelMeta = {
  ...colors(TINT.teal),
  icon: Activity,
  description: '',
};

const META: Record<string, PanelMeta> = {
  'Hypogonadism': {
    ...colors(TINT.blue),
    icon: Mars,
    description: 'Track reproductive and hormonal health.',
  },
  'Hypothyroidism': {
    ...colors(TINT.violet),
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Thyroid': {
    ...colors(TINT.violet),
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Adrenal': {
    ...colors(TINT.amber),
    icon: Wind,
    description: 'Assess adrenal and cortisol axis.',
  },
  'Insulin Resistance': {
    ...colors(TINT.green),
    icon: Droplets,
    description: 'Follow glucose metabolism and insulin sensitivity.',
  },
  'Cardiovascular Risk': {
    ...colors(TINT.rose),
    icon: Heart,
    description: 'Monitor key lipid and inflammatory markers.',
  },
  'Fatty Liver': {
    ...colors(TINT.cyan),
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Liver Health': {
    ...colors(TINT.cyan),
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Kidney Function': {
    ...colors({ ...TINT.amber, ink: TINT.ochreInk }),
    icon: KidneyIcon,
    description: 'Track renal health and electrolytes.',
  },
  'Anemia': {
    ...colors({ ...TINT.rose, ink: TINT.crimsonInk }),
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Hematology': {
    ...colors({ ...TINT.rose, ink: TINT.crimsonInk }),
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Bone and Mineral Metabolism': {
    ...colors(TINT.slate),
    icon: Bone,
    description: 'Track calcium, vitamin D and bone turnover.',
  },
  'Pancreatic Function': {
    ...colors(TINT.orange),
    icon: Pill,
    description: 'Monitor exocrine and endocrine pancreatic markers.',
  },
  'FBC': {
    ...colors(TINT.indigo),
    icon: Microscope,
    description: 'Full blood count — cells, haemoglobin, platelets.',
  },
};

export function getPanelMeta(name: string): PanelMeta {
  return META[name] ?? DEFAULT_META;
}
