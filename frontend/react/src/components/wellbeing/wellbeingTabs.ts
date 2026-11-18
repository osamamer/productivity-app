import { desktopTimeouts, desktopUsage } from '../../services/desktop';

export type WellbeingTabId = 'today' | 'report' | 'boundaries';

export interface WellbeingTab {
    id: WellbeingTabId;
    path: string;
    label: string;
}

// Screen time and boundaries need the Linux desktop app; the report's planned-and-timed part
// works anywhere, so a plain browser gets just the Report tab.
export const WELLBEING_TABS: WellbeingTab[] = [
    ...(desktopUsage ? [{ id: 'today', path: '/wellbeing/today', label: 'Today' }] as WellbeingTab[] : []),
    { id: 'report', path: '/wellbeing/report', label: 'Report' },
    ...(desktopTimeouts ? [{ id: 'boundaries', path: '/wellbeing/boundaries', label: 'Boundaries' }] as WellbeingTab[] : []),
];

export const hasWellbeing = WELLBEING_TABS.length > 0;
