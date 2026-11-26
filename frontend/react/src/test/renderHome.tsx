import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { server } from './server';
import { createFakeBackend, type FakeBackend } from './fakeBackend';
import type { Task } from '../types/Task';
import type { TaskGroup } from '../types/TaskGroup';

/**
 * Renders the real Home page inside the app's providers against a fake task API.
 * Modules are reloaded per call because the task services keep module-level caches
 * that would otherwise leak one test's tasks into the next.
 */
export async function renderHome({ tasks, groups, now = '2026-11-26T10:00:00Z' }: {
    tasks?: Task[];
    groups?: TaskGroup[];
    now?: string;
} = {}): Promise<FakeBackend> {
    vi.useFakeTimers({ now: new Date(now), shouldAdvanceTime: true, toFake: ['Date'] });
    vi.resetModules();
    const backend = createFakeBackend({ today: now.slice(0, 10), tasks, groups });
    server.use(...backend.handlers);

    const [{ MemoryRouter }, { AppThemeProvider }, { UserProvider }, { PomodoroProvider }, { TaskProvider }, { HomePage }] = await Promise.all([
        import('react-router-dom'),
        import('../contexts/ThemeContext'),
        import('../contexts/UserContext'),
        import('../contexts/PomodoroContext'),
        import('../contexts/TaskContext'),
        import('../pages/HomePage'),
    ]);

    render(
        <AppThemeProvider>
            <MemoryRouter initialEntries={['/home']}>
                <UserProvider>
                    <PomodoroProvider>
                        <TaskProvider>
                            <HomePage />
                        </TaskProvider>
                    </PomodoroProvider>
                </UserProvider>
            </MemoryRouter>
        </AppThemeProvider>,
    );
    return backend;
}
