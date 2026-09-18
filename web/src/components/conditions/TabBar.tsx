import { pressable } from './ui';

// Not used by the top nav, which has its own spacing, sizes and blocked state.
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: Readonly<{ tabs: readonly { id: T; label: string }[]; active: T; onChange: (id: T) => void }>) {
  return (
    <div className="mc-tabs">
      {tabs.map((tab) => (
        <div key={tab.id} {...pressable(() => onChange(tab.id))} className="mc-tab" data-active={active === tab.id || undefined}>
          {tab.label}
        </div>
      ))}
    </div>
  );
}
