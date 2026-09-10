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

/** Per-panel visual identity: accent color, card background tint, icon circle background, border color, icon, and short description. */
export type PanelMeta = {
  color: string;
  bgColor: string;
  iconBg: string;
  borderColor: string;
  icon: LucideIcon | IconComponent;
  description: string;
};

const DEFAULT_META: PanelMeta = {
  color: '#14757e',
  bgColor: '#f0fdfa',
  iconBg: '#ccfbf1',
  borderColor: '#ccfbf1',
  icon: Activity,
  description: '',
};

const META: Record<string, PanelMeta> = {
  'Hypogonadism': {
    color: '#0f2942',
    bgColor: '#f0f7ff',
    iconBg: '#dbeafe',
    borderColor: '#cfe2fe',
    icon: Mars,
    description: 'Track reproductive and hormonal health.',
  },
  'Hypothyroidism': {
    color: '#5842c3',
    bgColor: '#f5f3ff',
    iconBg: '#ede9fe',
    borderColor: '#ddd6fe',
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Thyroid': {
    color: '#5842c3',
    bgColor: '#f5f3ff',
    iconBg: '#ede9fe',
    borderColor: '#ddd6fe',
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Adrenal': {
    color: '#b45309',
    bgColor: '#fffbeb',
    iconBg: '#fef3c7',
    borderColor: '#fde68a',
    icon: Wind,
    description: 'Assess adrenal and cortisol axis.',
  },
  'Insulin Resistance': {
    color: '#0f766e',
    bgColor: '#f0fdf9',
    iconBg: '#ccfbf1',
    borderColor: '#c6f5ec',
    icon: Droplets,
    description: 'Follow glucose metabolism and insulin sensitivity.',
  },
  'Cardiovascular Risk': {
    color: '#be123c',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    borderColor: '#fed7dc',
    icon: Heart,
    description: 'Monitor key lipid and inflammatory markers.',
  },
  'Fatty Liver': {
    color: '#0097a7',
    bgColor: '#ecfeff',
    iconBg: '#cffafe',
    borderColor: '#bbf2f6',
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Liver Health': {
    color: '#0097a7',
    bgColor: '#ecfeff',
    iconBg: '#cffafe',
    borderColor: '#bbf2f6',
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Kidney Function': {
    color: '#a05e1c',
    bgColor: '#fffbeb',
    iconBg: '#fef3c7',
    borderColor: '#fde68a',
    icon: KidneyIcon,
    description: 'Track renal health and electrolytes.',
  },
  'Anemia': {
    color: '#9f1239',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    borderColor: '#fed7dc',
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Hematology': {
    color: '#9f1239',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    borderColor: '#fed7dc',
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Bone and Mineral Metabolism': {
    color: '#334155',
    bgColor: '#f8fafc',
    iconBg: '#e2e8f0',
    borderColor: '#e2e8f0',
    icon: Bone,
    description: 'Track calcium, vitamin D and bone turnover.',
  },
  'Pancreatic Function': {
    color: '#c2410c',
    bgColor: '#fff7ed',
    iconBg: '#ffedd5',
    borderColor: '#fed7aa',
    icon: Pill,
    description: 'Monitor exocrine and endocrine pancreatic markers.',
  },
  'FBC': {
    color: '#4338ca',
    bgColor: '#eef2ff',
    iconBg: '#e0e7ff',
    borderColor: '#c7d2fe',
    icon: Microscope,
    description: 'Full blood count — cells, haemoglobin, platelets.',
  },
};

export function getPanelMeta(name: string): PanelMeta {
  return META[name] ?? DEFAULT_META;
}
