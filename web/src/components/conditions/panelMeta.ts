import {
  Mars,
  Wind,
  Heart,
  Brain,
  Activity,
  Droplets,
  Bone,
  Pill,
  Microscope,
  type LucideIcon,
} from 'lucide-react';
import { LiverIcon, KidneyIcon, type IconComponent } from './customIcons';

/** Per-panel visual identity: accent color, icon, and short description. */
export type PanelMeta = { color: string; icon: LucideIcon | IconComponent; description: string };

const DEFAULT_META: PanelMeta = { color: '#14757e', icon: Activity, description: '' };

const META: Record<string, PanelMeta> = {
  'Hypogonadism':                { color: '#3b82f6', icon: Mars,        description: 'Track reproductive and hormonal health.' },
  'Hypothyroidism':              { color: '#8b5cf6', icon: Brain,       description: 'Monitor thyroid hormone levels and function.' },
  'Adrenal':                     { color: '#f59e0b', icon: Wind,        description: 'Assess adrenal and cortisol axis.' },
  'Insulin Resistance':          { color: '#14757e', icon: Droplets,    description: 'Follow glucose metabolism and insulin sensitivity.' },
  'Cardiovascular Risk':         { color: '#ef4444', icon: Heart,       description: 'Monitor key lipid and inflammatory markers.' },
  'Fatty Liver':                 { color: '#10b981', icon: LiverIcon,   description: 'Track liver enzyme and metabolic markers.' },
  'Kidney Function':             { color: '#06b6d4', icon: KidneyIcon,  description: 'Assess glomerular and tubular function.' },
  'Anemia':                      { color: '#f43f5e', icon: Droplets,    description: 'Monitor iron stores and red cell indices.' },
  'Bone and Mineral Metabolism': { color: '#64748b', icon: Bone,        description: 'Track calcium, vitamin D and bone turnover.' },
  'Pancreatic Function':         { color: '#f97316', icon: Pill,        description: 'Monitor exocrine and endocrine pancreatic markers.' },
  'FBC':                         { color: '#6366f1', icon: Microscope,  description: 'Full blood count — cells, haemoglobin, platelets.' },
};

export function getPanelMeta(name: string): PanelMeta {
  return META[name] ?? DEFAULT_META;
}
