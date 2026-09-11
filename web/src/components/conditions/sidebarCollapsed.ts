export const SIDEBAR_COLLAPSED_KEY = 'bloodtests_sidebar_collapsed_v1';

export function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
  } catch {
    // storage unavailable -- the choice lasts for this page only
  }
}
