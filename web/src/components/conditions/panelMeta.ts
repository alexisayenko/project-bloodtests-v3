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

/** Per-panel visual identity: accent color, card background tint, icon circle background, icon, and short description. */
export type PanelMeta = {
  color: string;
  bgColor: string;
  iconBg: string;
  icon: LucideIcon | IconComponent;
  description: string;
};

const DEFAULT_META: PanelMeta = {
  color: '#14757e',
  bgColor: '#f0fdfa',
  iconBg: '#ccfbf1',
  icon: Activity,
  description: '',
};

const META: Record<string, PanelMeta> = {
  'Hypogonadism': {
    color: '#2563eb',
    bgColor: '#eff6ff',
    iconBg: '#dbeafe',
    icon: Mars,
    description: 'Track reproductive and hormonal health.',
  },
  'Hypothyroidism': {
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    iconBg: '#ede9fe',
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Thyroid': {
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    iconBg: '#ede9fe',
    icon: ThyroidIcon,
    description: 'Monitor thyroid function and related markers.',
  },
  'Adrenal': {
    color: '#d97706',
    bgColor: '#fffbeb',
    iconBg: '#fef3c7',
    icon: Wind,
    description: 'Assess adrenal and cortisol axis.',
  },
  'Insulin Resistance': {
    color: '#0d9488',
    bgColor: '#f0fdfa',
    iconBg: '#ccfbf1',
    icon: Droplets,
    description: 'Follow glucose metabolism and insulin sensitivity.',
  },
  'Cardiovascular Risk': {
    color: '#e11d48',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    icon: Heart,
    description: 'Monitor key lipid and inflammatory markers.',
  },
  'Fatty Liver': {
    color: '#0891b2',
    bgColor: '#ecfeff',
    iconBg: '#cffafe',
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Liver Health': {
    color: '#0891b2',
    bgColor: '#ecfeff',
    iconBg: '#cffafe',
    icon: LiverIcon,
    description: 'Monitor liver enzymes and related markers.',
  },
  'Kidney Function': {
    color: '#b45309',
    bgColor: '#fefce8',
    iconBg: '#fef3c7',
    icon: KidneyIcon,
    description: 'Track renal health and electrolytes.',
  },
  'Anemia': {
    color: '#be123c',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Hematology': {
    color: '#be123c',
    bgColor: '#fff1f2',
    iconBg: '#ffe4e6',
    icon: Droplets,
    description: 'Track blood counts and iron status.',
  },
  'Bone and Mineral Metabolism': {
    color: '#475569',
    bgColor: '#f8fafc',
    iconBg: '#e2e8f0',
    icon: Bone,
    description: 'Track calcium, vitamin D and bone turnover.',
  },
  'Pancreatic Function': {
    color: '#ea580c',
    bgColor: '#fff7ed',
    iconBg: '#ffedd5',
    icon: Pill,
    description: 'Monitor exocrine and endocrine pancreatic markers.',
  },
  'FBC': {
    color: '#6366f1',
    bgColor: '#eef2ff',
    iconBg: '#e0e7ff',
    icon: Microscope,
    description: 'Full blood count — cells, haemoglobin, platelets.',
  },
};

export function getPanelMeta(name: string): PanelMeta {
  return META[name] ?? DEFAULT_META;
}
