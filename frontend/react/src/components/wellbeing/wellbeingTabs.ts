import { desktopTimeouts, desktopUsage } from '../../services/desktop';

export type WellbeingTabId = 'today' | 'report' | 'boundaries';

export interface WellbeingTab {
    id: WellbeingTabId;
    path: string;
    label: string;
}

// Screen time and boundaries are both recorded and enforced by the Linux desktop app, so a
// plain browser has no tabs and the page sends it home.
export const WELLBEING_TABS: WellbeingTab[] = [
    ...(desktopUsage ? [{ id: 'today', path: '/wellbeing/today', label: 'Today' }, { id: 'report', path: '/wellbeing/report', label: 'Report' }] as WellbeingTab[] : []),
    ...(desktopTimeouts ? [{ id: 'boundaries', path: '/wellbeing/boundaries', label: 'Boundaries' }] as WellbeingTab[] : []),
];

export const hasWellbeing = WELLBEING_TABS.length > 0;
