import type { TimedApp, TimeoutState } from '../../services/desktop';
import { displayUrl } from './boundaryText';

export interface DailyStatus {
    limitSeconds: number;
    usedSeconds: number;
    leftSeconds: number;
}

export interface BoundaryStatusRow {
    key: string;
    name: string;
    icon: string | null;
    daily: DailyStatus | null;
    // What the current session is doing, or null when the boundary has no session timer.
    session: string | null;
    // Whether a session is counting down right now.
    live: boolean;
    opensToday: number;
    opensLabel: string;
}

/** "4:05" or "1:02:09": a countdown that ticks every second. */
export function formatClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.ceil(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = String(seconds % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function daily(limitSeconds: number | undefined, usedSeconds = 0): DailyStatus | null {
    if (!limitSeconds) return null;
    return { limitSeconds, usedSeconds, leftSeconds: Math.max(0, limitSeconds - usedSeconds) };
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function appSession(app: TimedApp, now: number): { text: string | null; live: boolean } {
    if (!app.settings?.closeAfterSeconds) return { text: null, live: false };
    const session = app.session;
    if (!session) return { text: 'No session running', live: false };
    const left = formatClock((session.deadline - now) / 1000);
    if (session.state === 'starting') return { text: 'Starting…', live: false };
    if (session.state === 'paused') return { text: `Paused while minimized · ${left} left`, live: false };
    if (session.state === 'closed') return { text: `Closed · ${left} left if reopened`, live: true };
    const action = app.settings.onTimeUp === 'minimize' ? 'Minimizes' : 'Closes';
    return { text: `${action} in ${left}`, live: true };
}

function appRow(app: TimedApp, now: number): BoundaryStatusRow {
    const session = appSession(app, now);
    const opensToday = app.opensToday ?? 0;
    return {
        key: `app:${app.id}`,
        name: app.name,
        icon: app.icon,
        daily: daily(app.settings?.dailyLimitSeconds, app.usedTodaySeconds),
        session: session.text,
        live: session.live,
        opensToday,
        opensLabel: plural(opensToday, 'session'),
    };
}

/**
 * One row per app with an auto-close or daily limit and per site timer: time left today, what
 * the current session is doing, and how many sessions started today. `now` is epoch ms.
 */
export function boundaryStatusRows(state: Pick<TimeoutState, 'apps' | 'urls' | 'browser'>, now: number): BoundaryStatusRow[] {
    const apps = state.apps
        .filter(app => app.settings && (app.settings.closeAfterSeconds || app.settings.dailyLimitSeconds))
        .map(app => appRow(app, now));
    const deadline = state.browser.sessionDeadline;
    const sites = state.urls.map(site => {
        const open = deadline !== null && deadline > now && state.browser.unlockedUrls.includes(site.url);
        const opensToday = site.opensToday ?? 0;
        return {
            key: `site:${site.url}`,
            name: displayUrl(site.url),
            icon: null,
            daily: daily(site.dailyLimitSeconds, site.usedTodaySeconds),
            session: open ? `Firefox closes in ${formatClock((deadline - now) / 1000)}` : 'Not open',
            live: open,
            opensToday,
            opensLabel: plural(opensToday, 'open'),
        };
    });
    return [...apps, ...sites];
}
