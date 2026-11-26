import { http, HttpResponse, type HttpHandler } from 'msw';
import type { Task } from '../types/Task';
import type { TaskGroup } from '../types/TaskGroup';
import { API } from './server';

type TaskOverrides = Partial<Task> & Pick<Task, 'name'>;

let nextId = 1;

export function makeTask(overrides: TaskOverrides): Task {
    const id = overrides.taskId ?? `task-${nextId++}`;
    return {
        taskId: id,
        description: '',
        completed: false,
        creationDateTime: '2026-11-20T09:00:00',
        creationDate: '2026-11-20',
        scheduledPerformDateTime: null,
        timeZone: 'UTC',
        reminderMinutesBefore: null,
        completionDateTime: '',
        parentId: '',
        tag: '',
        importance: 5,
        displayOrder: 0,
        mentalThreadId: null,
        projectId: null,
        taskSeriesId: null,
        seriesOccurrenceAt: null,
        skipped: false,
        ...overrides,
    };
}

export type FakeBackend = {
    tasks: Task[];
    groups: TaskGroup[];
    requests: string[];
    handlers: HttpHandler[];
};

function deletionReceipt(taskIds: string[]) {
    return {
        taskIds,
        taskSeriesIds: [],
        taskSessionIds: [],
        scheduledJobIds: [],
        pomodoroIds: [],
        reminderIds: [],
        taskGroupIds: [],
        taskGroupMembershipIds: [],
        linkedStatDefinitionsBySeries: {},
    };
}

function localDate(value: string | null): string | null {
    return value ? value.slice(0, 10) : null;
}

/**
 * An in-memory stand-in for the task API, enough for Home to load, create, complete,
 * reorder and delete tasks. Everything Home reads but these tests do not exercise
 * answers empty.
 */
export function createFakeBackend({ today, tasks = [], groups = [] }: {
    today: string;
    tasks?: Task[];
    groups?: TaskGroup[];
}): FakeBackend {
    const backend: FakeBackend = { tasks: [...tasks], groups: [...groups], requests: [], handlers: [] };
    const deleted: Task[] = [];
    const find = (taskId: string) => backend.tasks.find(task => task.taskId === taskId);
    const mainTasks = () => backend.tasks.filter(task => !task.parentId);

    backend.handlers = [
        http.all(`${API}/*`, ({ request }) => {
            backend.requests.push(`${request.method} ${new URL(request.url).pathname}`);
            return undefined;
        }),
        http.get(`${API}/api/v1/tasks/today`, () => HttpResponse.json(
            mainTasks().filter(task => localDate(task.scheduledPerformDateTime) === today),
        )),
        http.get(`${API}/api/v1/tasks/focus-today`, () => HttpResponse.json({ date: today, totalFocusSeconds: 0 })),
        http.get(`${API}/api/v1/tasks`, ({ request }) => {
            const params = new URL(request.url).searchParams;
            const date = params.get('date');
            if (date) return HttpResponse.json(mainTasks().filter(task => localDate(task.scheduledPerformDateTime) === date));
            if (params.get('period') === 'PAST') {
                return HttpResponse.json(mainTasks().filter(task => {
                    const scheduled = localDate(task.scheduledPerformDateTime);
                    return scheduled !== null && scheduled < today && !task.completed;
                }));
            }
            return HttpResponse.json(mainTasks());
        }),
        http.post(`${API}/api/v1/tasks`, async ({ request }) => {
            const body = await request.json() as Partial<Task>;
            const created = makeTask({
                name: body.name ?? '',
                description: body.description ?? '',
                scheduledPerformDateTime: body.scheduledPerformDateTime ?? null,
                importance: body.importance ?? 5,
                tag: body.tag ?? '',
                parentId: body.parentId ?? '',
            });
            backend.tasks.push(created);
            return HttpResponse.json(created);
        }),
        http.put(`${API}/api/v1/tasks/order`, async ({ request }) => {
            const ids = await request.json() as string[];
            ids.forEach((id, index) => {
                const task = find(id);
                if (task) task.displayOrder = index;
            });
            return HttpResponse.json(ids.map(find).filter(Boolean));
        }),
        http.get(`${API}/api/v1/tasks/:taskId`, ({ params }) => {
            const task = find(String(params.taskId));
            return task ? HttpResponse.json(task) : new HttpResponse(null, { status: 404 });
        }),
        http.get(`${API}/api/v1/tasks/:taskId/subtasks`, ({ params }) => HttpResponse.json(
            backend.tasks.filter(task => task.parentId === params.taskId),
        )),
        http.patch(`${API}/api/v1/tasks/:taskId`, async ({ params, request }) => {
            const task = find(String(params.taskId));
            if (!task) return new HttpResponse(null, { status: 404 });
            Object.assign(task, await request.json() as Partial<Task>);
            return HttpResponse.json(task);
        }),
        http.delete(`${API}/api/v1/tasks/:taskId`, ({ params }) => {
            const removed = backend.tasks.filter(task => task.taskId === params.taskId || task.parentId === params.taskId);
            backend.tasks = backend.tasks.filter(task => !removed.includes(task));
            deleted.push(...removed);
            return HttpResponse.json(deletionReceipt(removed.map(task => task.taskId)));
        }),
        http.post(`${API}/api/v1/tasks/deletions/restore`, async ({ request }) => {
            const { taskIds } = await request.json() as { taskIds: string[] };
            const restored = deleted.filter(task => taskIds.includes(task.taskId));
            backend.tasks.push(...restored);
            return new HttpResponse(null, { status: 204 });
        }),
        http.get(`${API}/api/v1/task-groups`, () => HttpResponse.json(backend.groups)),
        http.get(`${API}/api/v1/pomodoro/status`, () => new HttpResponse(null, { status: 204 })),
        http.get(`${API}/api/v1/activity-sessions/current`, () => new HttpResponse(null, { status: 204 })),
        http.get(`${API}/api/v1/mental-state/check-ins`, () => HttpResponse.json([])),
        http.get(`${API}/api/v1/events`, () => HttpResponse.json([])),
        http.get(`${API}/api/v1/calendars`, () => HttpResponse.json([])),
        http.get(`${API}/api/v1/*`, () => HttpResponse.json([])),
    ];
    return backend;
}
