import { pressable } from './ui';

// An in-page tab strip, sitting under a view's heading. The top nav is NOT one
// of these: it has its own spacing (.mc-nav), font size and blocked state. The
// look lives in `.mc-tab`, since hover and focus need selectors.
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
