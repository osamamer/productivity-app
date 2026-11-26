import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { server } from './server';
import { createFakeBackend, type FakeBackend } from './fakeBackend';
import type { CalendarEvent } from '../types/CalendarEvent';
import type { Task } from '../types/Task';
import type { TaskGroup } from '../types/TaskGroup';

export type PageFixture = {
    tasks?: Task[];
    groups?: TaskGroup[];
    events?: CalendarEvent[];
    now?: string;
    path?: string;
};

/**
 * Renders a real page inside the app's providers against the fake API. Modules are reloaded per
 * call because the services keep module-level caches that would otherwise leak one test's data
 * into the next, so the page is passed as a loader that imports it after the reset.
 */
export async function renderPage(
    loadPage: () => Promise<ReactElement>,
    { tasks, groups, events, now = '2026-11-26T10:00:00Z', path = '/' }: PageFixture = {},
): Promise<FakeBackend> {
    vi.useFakeTimers({ now: new Date(now), shouldAdvanceTime: true, toFake: ['Date'] });
    vi.resetModules();
    const backend = createFakeBackend({ today: now.slice(0, 10), tasks, groups, events });
    server.use(...backend.handlers);

    const [{ MemoryRouter }, { AppThemeProvider }, { UserProvider }, { PomodoroProvider }, { TaskProvider }, page] = await Promise.all([
        import('react-router-dom'),
        import('../contexts/ThemeContext'),
        import('../contexts/UserContext'),
        import('../contexts/PomodoroContext'),
        import('../contexts/TaskContext'),
        loadPage(),
    ]);

    render(
        <AppThemeProvider>
            <MemoryRouter initialEntries={[path]}>
                <UserProvider>
                    <PomodoroProvider>
                        <TaskProvider>{page}</TaskProvider>
                    </PomodoroProvider>
                </UserProvider>
            </MemoryRouter>
        </AppThemeProvider>,
    );
    return backend;
}
