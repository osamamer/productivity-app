import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeEvent, makeTask } from '../test/fakeBackend';
import { renderHome } from '../test/renderHome';
import { API, server } from '../test/server';

const TODAY = '2026-11-26';

afterEach(() => vi.useRealTimers());

function todayTask(name: string, overrides = {}) {
    return makeTask({ name, scheduledPerformDateTime: `${TODAY}T09:00:00`, ...overrides });
}

describe('Home (labor)', () => {
    it("lists today's open tasks and leaves other days off the list", async () => {
        await renderHome({
            tasks: [
                todayTask('Write report'),
                makeTask({ name: 'Next week', scheduledPerformDateTime: '2026-12-03T09:00:00' }),
            ],
        });

        expect(await screen.findByText('Write report')).toBeInTheDocument();
        expect(screen.queryByText('Next week')).not.toBeInTheDocument();
    });

    it('keeps unfinished tasks from earlier days behind a "View older tasks" toggle', async () => {
        const user = userEvent.setup();
        await renderHome({
            tasks: [
                todayTask('Write report'),
                makeTask({ name: 'Old chore', scheduledPerformDateTime: '2026-11-20T09:00:00' }),
            ],
        });

        await screen.findByText('Write report');
        expect(screen.queryByText('Old chore')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'View older tasks (1)' }));

        expect(await screen.findByText('Old chore')).toBeInTheDocument();
    });

    it('adds a task typed into the input for today', async () => {
        const user = userEvent.setup();
        const backend = await renderHome({ tasks: [todayTask('Write report')] });
        await screen.findByText('Write report');

        await user.type(screen.getByPlaceholderText('Add a task...'), 'Call the plumber{Enter}');

        expect(await screen.findByText('Call the plumber')).toBeInTheDocument();
        await waitFor(() => expect(backend.tasks.map(task => task.name)).toContain('Call the plumber'));
        const created = backend.tasks.find(task => task.name === 'Call the plumber');
        expect(created?.scheduledPerformDateTime?.slice(0, 10)).toBe(TODAY);
    });

    it('completes a task from its checkbox and offers to undo it', async () => {
        const user = userEvent.setup();
        const backend = await renderHome({ tasks: [todayTask('Write report'), todayTask('Stretch')] });

        await user.click(await screen.findByRole('checkbox', { name: 'Complete task Write report' }));

        await waitFor(() => expect(backend.tasks.find(task => task.name === 'Write report')?.completed).toBe(true));
        const feedback = await screen.findByRole('alert');
        expect(feedback).toHaveTextContent('Task completed');

        await user.click(within(feedback).getByRole('button', { name: 'Undo' }));

        await waitFor(() => expect(backend.tasks.find(task => task.name === 'Write report')?.completed).toBe(false));
    });

    it('asks before deleting a task, then deletes it and can restore it', async () => {
        const user = userEvent.setup();
        const backend = await renderHome({ tasks: [todayTask('Write report'), todayTask('Stretch')] });

        await user.click(await screen.findByRole('button', { name: 'Delete task Write report' }));
        expect(screen.getByText('Delete “Write report” and its subtasks?')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.queryByText('Write report')).not.toBeInTheDocument());
        expect(backend.tasks.map(task => task.name)).toEqual(['Stretch']);
        const feedback = await screen.findByRole('alert');
        expect(feedback).toHaveTextContent('Task deleted');

        await user.click(within(feedback).getByRole('button', { name: 'Undo' }));

        expect(await screen.findByText('Write report')).toBeInTheDocument();
        expect(backend.tasks.map(task => task.name).sort()).toEqual(['Stretch', 'Write report']);
    });

    it('cancelling the delete prompt keeps the task', async () => {
        const user = userEvent.setup();
        const backend = await renderHome({ tasks: [todayTask('Write report')] });

        await user.click(await screen.findByRole('button', { name: 'Delete task Write report' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.getByText('Write report')).toBeInTheDocument();
        expect(backend.requests.some(request => request.startsWith('DELETE'))).toBe(false);
    });

    it('puts a failed delete back and says so', async () => {
        const user = userEvent.setup();
        await renderHome({ tasks: [todayTask('Write report'), todayTask('Stretch')] });
        server.use(http.delete(`${API}/api/v1/tasks/:taskId`, () => new HttpResponse(null, { status: 500 })));

        await user.click(await screen.findByRole('button', { name: 'Delete task Write report' }));
        await user.click(screen.getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Could not delete the selected task data')).toBeInTheDocument();
        expect(screen.getByText('Write report')).toBeInTheDocument();
    });

    it('shows grouped tasks under their group name', async () => {
        const first = todayTask('Brush teeth');
        const second = todayTask('Make bed');
        await renderHome({
            tasks: [first, second, todayTask('Write report')],
            groups: [{ groupId: 'group-1', name: 'Morning routine', taskIds: [first.taskId, second.taskId], displayOrder: 0 }],
        });

        expect(await screen.findByText('Morning routine')).toBeInTheDocument();
        expect(screen.getByText('Write report')).toBeInTheDocument();
    });

    it("lists today's calendar events and leaves other days' off", async () => {
        await renderHome({
            events: [
                makeEvent({ title: 'Dentist', startDate: TODAY, endDate: TODAY, startTime: `${TODAY}T14:00:00`, endTime: `${TODAY}T15:00:00` }),
                makeEvent({ title: 'Conference', startDate: '2026-12-02', endDate: '2026-12-02', startTime: '2026-12-02T09:00:00', endTime: '2026-12-02T17:00:00' }),
            ],
        });

        expect(await screen.findByText('Dentist')).toBeInTheDocument();
        expect(screen.queryByText('Conference')).not.toBeInTheDocument();
    });

    it("keeps the task list working when an event can't be read", async () => {
        await renderHome({
            tasks: [todayTask('Write report')],
            events: [makeEvent({ title: 'Broken', startDate: TODAY, endDate: TODAY, startTime: 'not a time', endTime: 'not a time' })],
        });

        expect(await screen.findByText('Write report')).toBeInTheDocument();
        expect(await screen.findByText("Today's events could not be shown.")).toBeInTheDocument();
    });

    it('offers a retry when task groups fail to load, and shows them once they do', async () => {
        const user = userEvent.setup();
        let failGroups = true;
        await renderHome({
            tasks: [todayTask('Write report')],
            handlers: [http.get(`${API}/api/v1/task-groups`, () => (failGroups
                ? new HttpResponse(null, { status: 500 })
                : HttpResponse.json([])))],
        });

        const alert = await screen.findByRole('alert', {}, { timeout: 8000 });
        expect(alert).toHaveTextContent('Could not load task groups.');
        failGroups = false;
        await user.click(within(alert).getByRole('button', { name: 'Retry' }));

        expect(await screen.findByText('Write report')).toBeInTheDocument();
        expect(screen.queryByText('Could not load task groups.')).not.toBeInTheDocument();
    }, 15000);
});
