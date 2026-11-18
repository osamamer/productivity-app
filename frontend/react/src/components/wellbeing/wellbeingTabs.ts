import { desktopTimeouts, desktopUsage } from '../../services/desktop';

export interface WellbeingTab {
    path: string;
    label: string;
}

// Screen time and boundaries are both recorded and enforced by the Linux desktop app, so a
// plain browser has no tabs and the page sends it home.
export const WELLBEING_TABS: WellbeingTab[] = [
    ...(desktopUsage ? [{ path: '/wellbeing/today', label: 'Today' }, { path: '/wellbeing/report', label: 'Report' }] : []),
    ...(desktopTimeouts ? [{ path: '/wellbeing/boundaries', label: 'Boundaries' }] : []),
];

export const hasWellbeing = WELLBEING_TABS.length > 0;
