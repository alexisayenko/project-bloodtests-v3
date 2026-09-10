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
  CircleDot,
  type LucideIcon,
} from 'lucide-react';

/** Per-panel visual identity: accent color and icon. */
export type PanelMeta = { color: string; icon: LucideIcon };

const DEFAULT_META: PanelMeta = { color: '#14757e', icon: Activity };

const META: Record<string, PanelMeta> = {
  'Hypogonadism':                { color: '#3b82f6', icon: Mars },
  'Hypothyroidism':              { color: '#8b5cf6', icon: Brain },
  'Adrenal':                     { color: '#f59e0b', icon: Wind },
  'Insulin Resistance':          { color: '#14757e', icon: Droplets },
  'Cardiovascular Risk':         { color: '#ef4444', icon: Heart },
  'Fatty Liver':                 { color: '#10b981', icon: Activity },
  'Kidney Function':             { color: '#06b6d4', icon: CircleDot },
  'Anemia':                      { color: '#f43f5e', icon: Droplets },
  'Bone and Mineral Metabolism': { color: '#64748b', icon: Bone },
  'Pancreatic Function':         { color: '#f97316', icon: Pill },
  'FBC':                         { color: '#6366f1', icon: Microscope },
};

export function getPanelMeta(name: string): PanelMeta {
  return META[name] ?? DEFAULT_META;
}
