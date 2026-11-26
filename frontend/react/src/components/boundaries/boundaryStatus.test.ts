import { describe, expect, it } from 'vitest';
import type { TimedApp, TimeoutState } from '../../services/desktop';
import { boundaryStatusRows, formatClock } from './boundaryStatus';

const NOW = 1_800_000_000_000;

function app(overrides: Partial<TimedApp> & Pick<TimedApp, 'id' | 'name'>): TimedApp {
    return { icon: null, aliases: [overrides.id], settings: null, ...overrides };
}

const settings = {
    delaySeconds: 30, closeAfterSeconds: 1800, dailyLimitSeconds: 3600, autoOpen: false, message: '',
    countMinimized: true, onTimeUp: 'close' as const,
};

function state(partial: Partial<Pick<TimeoutState, 'apps' | 'urls' | 'browser'>>) {
    return {
        apps: [],
        urls: [],
        browser: { hostInstalled: true, extensionDir: '', sessionDeadline: null, unlockedUrls: [] },
        ...partial,
    };
}

describe('formatClock', () => {
    it('counts down in minutes and seconds, adding hours only when needed', () => {
        expect(formatClock(245)).toBe('4:05');
        expect(formatClock(3729)).toBe('1:02:09');
        expect(formatClock(-3)).toBe('0:00');
    });
});

describe('boundaryStatusRows', () => {
    it('lists only apps with an auto-close or daily limit', () => {
        const rows = boundaryStatusRows(state({
            apps: [
                app({ id: 'paused-only', name: 'Pause only', settings: { ...settings, closeAfterSeconds: 0, dailyLimitSeconds: 0 } }),
                app({ id: 'none', name: 'Unlimited' }),
                app({ id: 'chat', name: 'Chat', settings }),
            ],
        }), NOW);
        expect(rows.map(row => row.name)).toEqual(['Chat']);
    });

    it('shows time left today and a running session counting down', () => {
        const [row] = boundaryStatusRows(state({
            apps: [app({
                id: 'chat', name: 'Chat', settings, usedTodaySeconds: 2700, opensToday: 3,
                session: { deadline: NOW + 125_000, totalSeconds: 900, state: 'running' },
            })],
        }), NOW);
        expect(row.daily).toEqual({ limitSeconds: 3600, usedSeconds: 2700, leftSeconds: 900 });
        expect(row.session).toBe('Closes in 2:05');
        expect(row.live).toBe(true);
        expect(row.opensLabel).toBe('3 sessions');
    });

    it('says when a session is paused, closed early or not running', () => {
        const rowFor = (session: TimedApp['session']) => boundaryStatusRows(state({
            apps: [app({ id: 'chat', name: 'Chat', settings: { ...settings, onTimeUp: 'minimize' }, session })],
        }), NOW)[0];
        expect(rowFor({ deadline: NOW + 60_000, totalSeconds: 900, state: 'paused' }).session).toBe('Paused while minimized · 1:00 left');
        expect(rowFor({ deadline: NOW + 60_000, totalSeconds: 900, state: 'closed' }).session).toBe('Closed · 1:00 left if reopened');
        expect(rowFor({ deadline: NOW + 60_000, totalSeconds: 900, state: 'running' }).session).toBe('Minimizes in 1:00');
        expect(rowFor(null).session).toBe('No session running');
    });

    it('has no session line for an app with only a daily limit', () => {
        const [row] = boundaryStatusRows(state({
            apps: [app({ id: 'music', name: 'Music', settings: { ...settings, closeAfterSeconds: 0 } })],
        }), NOW);
        expect(row.session).toBeNull();
    });

    it('shows when Firefox closes for sites unlocked in the running session', () => {
        const site = { delaySeconds: 30, closeAfterSeconds: 900, dailyLimitSeconds: 1800, message: '', usedTodaySeconds: 600, opensToday: 1 };
        const rows = boundaryStatusRows(state({
            urls: [{ url: 'https://www.instagram.com/', ...site }, { url: 'https://www.reddit.com/', ...site, dailyLimitSeconds: 0 }],
            browser: { hostInstalled: true, extensionDir: '', sessionDeadline: NOW + 300_000, unlockedUrls: ['https://www.instagram.com/'] },
        }), NOW);
        expect(rows.map(row => [row.name, row.session, row.opensLabel])).toEqual([
            ['www.instagram.com', 'Firefox closes in 5:00', '1 open'],
            ['www.reddit.com', 'Not open', '1 open'],
        ]);
        expect(rows[1].daily).toBeNull();
    });
});
