import type { Panel } from '../../types';

export function PanelIcon({ panel }: { panel: Panel }) {
  if (panel.iconFile) {
    return (
      <div
        className="panel-icon-mask"
        style={{
          WebkitMaskImage: `url(./icons/${panel.iconFile})`,
          maskImage: `url(./icons/${panel.iconFile})`,
          backgroundColor: panel.color || 'white',
        }}
      />
    );
  }
  if (panel.icon) {
    return (
      <svg
        className="panel-icon"
        viewBox="0 0 24 24"
        width="32"
        height="32"
        fill="none"
        dangerouslySetInnerHTML={{ __html: panel.icon }}
      />
    );
  }
  return null;
}
