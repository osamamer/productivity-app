import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../test/renderPage';
import { API } from '../test/server';
import type {
    Checkpoint, CheckpointDraft, Milestone, MilestoneDraft, Path, PathDraft, PathRoad, PathsOverview, PathView, WeekStrength,
} from '../types/Path';
import type { StatDefinition } from '../types/Stats';

afterEach(() => vi.useRealTimers());

const NOW = '2026-11-26T10:00:00Z';
const gym: StatDefinition = { id: 'gym', name: 'Gym', type: 'BOOLEAN', morality: 'GOOD', displayOrder: 0, userId: 'user' };
const words: StatDefinition = { id: 'words', name: 'Words', type: 'NUMBER', unit: 'words', displayOrder: 1, userId: 'user' };

function checkpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
    return {
        id: 'act-two', projectId: 'project-rewrite', name: 'Act II done', targetDate: '2027-02-25', displayOrder: 0,
        metric: { statDefinitionId: 'words', statName: 'Words', unit: 'words', valueSource: 'VALUE', valueType: 'NUMBER',
            aggregation: 'SUM', countFrom: '2026-11-01', baseline: 70_100, targetValue: 99_000, falling: false },
        current: 72_100, progress: 0.73, reachedOn: null, taskCount: 0, completedTaskCount: 0, ...overrides,
    };
}

function milestone(overrides: Partial<Milestone> = {}): Milestone {
    return {
        id: 'rewrite', projectId: 'project-rewrite', name: 'Finish the rewrite', targetDate: '2027-07-22', displayOrder: 0,
        done: false, doneOn: null, progress: 0.49, taskCount: 0, completedTaskCount: 0, checkpoints: [], ...overrides,
    };
}

function weeks(achieved: number[], target: number): WeekStrength[] {
    // Oldest first, ending with the current week (which began on Sunday 2026-11-22).
    return achieved.map((count, index) => {
        const start = new Date(Date.UTC(2026, 10, 22 - 7 * (achieved.length - 1 - index)));
        return { weekStart: start.toISOString().slice(0, 10), elapsedDays: 7, strength: count / target, inputs: [{ score: count / target, achieved: count }] };
    });
}

function gymPath(overrides: Partial<Path> = {}): Path {
    return {
        id: 'body', name: 'Body', color: '#F08E84', icon: 'body', displayOrder: 0, paused: false,
        signal: { combineMethod: 'AVERAGE', inputs: [{
            id: 'input', statDefinitionId: 'gym', statName: 'Gym', unit: null, valueSource: 'VALUE', valueType: 'BOOLEAN',
            direction: 'MORE_IS_BETTER', period: 'WEEK', scoring: 'TIMES', target: 4, weight: 1,
        }] },
        ...overrides,
    };
}

/** An in-memory paths API: the overview, the switches, creation and signal previews. */
function pathsApi(initial: PathRoad[]) {
    const state = {
        roads: [...initial],
        view: { sort: 'ATTENTION', shape: 'CURVED', edges: 'FOLLOW_WEEKS' } as PathView,
        viewUpdates: [] as Partial<PathView>[],
        created: [] as PathDraft[],
        milestonesCreated: [] as MilestoneDraft[],
        checkpointsCreated: [] as CheckpointDraft[],
    };
    const handlers = [
        http.get(`${API}/api/v1/paths/overview`, () => HttpResponse.json<PathsOverview>({ today: '2026-11-26', view: state.view, paths: state.roads })),
        http.put(`${API}/api/v1/paths/view`, async ({ request }) => {
            const change = await request.json() as Partial<PathView>;
            state.viewUpdates.push(change);
            state.view = { ...state.view, ...change };
            return HttpResponse.json(state.view);
        }),
        http.post(`${API}/api/v1/paths/signal-preview`, () => HttpResponse.json({ signal: gymPath().signal, weeks: weeks([2, 4], 4) })),
        http.post(`${API}/api/v1/paths`, async ({ request }) => {
            const draft = await request.json() as PathDraft;
            state.created.push(draft);
            const path = gymPath({ id: 'new', name: draft.name ?? '', color: draft.color ?? '#A395F2' });
            state.roads.push({ path, weeks: weeks([0, 0, 3, 2], 4), milestones: [] });
            return HttpResponse.json(path, { status: 201 });
        }),
        http.get(`${API}/api/v1/stats/definitions`, () => HttpResponse.json([gym, words])),
        http.post(`${API}/api/v1/paths/:pathId/milestones`, async ({ params, request }) => {
            const draft = await request.json() as MilestoneDraft;
            state.milestonesCreated.push(draft);
            const created = milestone({ id: 'created', projectId: 'project-created', name: draft.name ?? '', targetDate: draft.targetDate ?? null, progress: 0 });
            state.roads.find(road => road.path.id === params.pathId)?.milestones.push(created);
            return HttpResponse.json(created, { status: 201 });
        }),
        http.post(`${API}/api/v1/projects/:projectId/checkpoints`, async ({ params, request }) => {
            const draft = await request.json() as CheckpointDraft;
            state.checkpointsCreated.push(draft);
            const created = checkpoint({ id: 'created-checkpoint', projectId: String(params.projectId), name: draft.name ?? '' });
            state.roads.flatMap(road => road.milestones).find(item => item.projectId === params.projectId)?.checkpoints.push(created);
            return HttpResponse.json(created, { status: 201 });
        }),
    ];
    return { state, handlers };
}

async function renderPaths(roads: PathRoad[]) {
    const api = pathsApi(roads);
    await renderPage(() => import('./PathsPage').then(({ PathsPage }) => <PathsPage />), { now: NOW, path: '/paths', handlers: api.handlers });
    return api.state;
}

describe('Paths', () => {
    it('draws a road per path and says how many are on pace this week', async () => {
        await renderPaths([
            { path: gymPath(), weeks: weeks([4, 3, 4, 4], 4), milestones: [] },
            { path: gymPath({ id: 'writer', name: 'Writer', icon: 'writer', displayOrder: 1 }), weeks: weeks([4, 2, 1, 2], 4), milestones: [] },
        ]);

        expect(await screen.findByRole('img', { name: 'Body path' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Writer path' })).toBeInTheDocument();
        expect(screen.getByText(/This week,/)).toHaveTextContent('This week, 1 of 2 paths are on pace.');
        expect(screen.getAllByText('Gym · 4×/wk')).toHaveLength(2);
    });

    it('puts the path that needs attention first by default', async () => {
        await renderPaths([
            { path: gymPath(), weeks: weeks([4, 4, 4, 4], 4), milestones: [] },
            { path: gymPath({ id: 'writer', name: 'Writer', displayOrder: 1 }), weeks: weeks([1, 0, 1, 0], 4), milestones: [] },
        ]);

        await screen.findByRole('img', { name: 'Body path' });
        const roads = screen.getAllByRole('img', { name: / path$/ }).map(road => road.getAttribute('aria-label'));
        expect(roads).toEqual(['Writer path', 'Body path']);
    });

    it('names a week when its centre dash is hovered', async () => {
        await renderPaths([{ path: gymPath(), weeks: weeks([3, 2], 4), milestones: [] }]);

        const road = await screen.findByRole('img', { name: 'Body path' });
        const lastWeek = road.querySelector('[data-tip^="Week of Nov 15"] path') as Element;
        fireEvent.pointerMove(lastWeek, { clientX: 10, clientY: 10 });

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Week of Nov 15 · 3 of 4');
    });

    it('remembers the switches', async () => {
        const user = userEvent.setup();
        const api = await renderPaths([{ path: gymPath(), weeks: weeks([3, 2], 4), milestones: [] }]);

        await user.click(await screen.findByRole('button', { name: 'Straight' }));

        await waitFor(() => expect(api.viewUpdates).toEqual([{ shape: 'STRAIGHT' }]));
        expect(screen.getByRole('button', { name: 'Straight' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('creates a first path from a stat the user already logs', async () => {
        const user = userEvent.setup();
        const api = await renderPaths([]);

        await user.click(await screen.findByRole('button', { name: 'New path' }));
        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByLabelText('Name'), 'Body');
        await user.click(await within(dialog).findByRole('button', { name: 'Add a stat' }));
        const target = within(dialog).getByLabelText('Target (times a week)');
        await user.clear(target);
        await user.type(target, '4');
        expect(await within(dialog).findByRole('list', { name: 'Recent weeks' })).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Create path' }));

        await waitFor(() => expect(api.created).toHaveLength(1));
        expect(api.created[0]).toMatchObject({
            name: 'Body',
            signal: { combineMethod: 'AVERAGE', inputs: [{ statDefinitionId: 'gym', scoring: 'TIMES', target: 4, direction: 'MORE_IS_BETTER' }] },
        });
        expect(await screen.findByRole('img', { name: 'Body path' })).toBeInTheDocument();
    });

    it('draws milestones as rings ahead, done ones behind and undated ones in Someday', async () => {
        await renderPaths([{
            path: gymPath(), weeks: weeks([3, 2], 4), milestones: [
                milestone({ checkpoints: [checkpoint()] }),
                milestone({ id: 'edit', projectId: 'project-edit', name: 'Edit it', targetDate: null, displayOrder: 1 }),
                milestone({ id: 'tenk', projectId: 'project-tenk', name: 'First 10k', done: true, doneOn: '2026-11-15', displayOrder: 2 }),
            ],
        }]);

        await screen.findByRole('img', { name: 'Body path' });
        expect(screen.getByRole('button', { name: 'Milestone Finish the rewrite' })).toHaveTextContent('49% · Jul 22');
        expect(screen.getByRole('button', { name: 'Milestone Edit it' })).toHaveTextContent('not planned yet');
        expect(screen.getByRole('button', { name: 'Milestone First 10k' })).toHaveTextContent('✓ First 10kDone · Nov 15');
    });

    it('shows a checkpoint’s progress when its tick is hovered', async () => {
        await renderPaths([{ path: gymPath(), weeks: weeks([3, 2], 4), milestones: [milestone({ checkpoints: [checkpoint()] })] }]);

        const road = await screen.findByRole('img', { name: 'Body path' });
        fireEvent.pointerMove(road.querySelector('.path-checkpoint line') as Element, { clientX: 10, clientY: 10 });

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Act II done · Feb 25 · 72k of 99k words');
    });

    it('adds a milestone from the path editor and a checkpoint measured by a stat', async () => {
        const user = userEvent.setup();
        const api = await renderPaths([{ path: gymPath(), weeks: weeks([3, 2], 4), milestones: [] }]);

        await user.click(await screen.findByRole('button', { name: 'Edit Body' }));
        await user.click(await screen.findByRole('button', { name: 'Add a milestone' }));
        let dialog = await screen.findByRole('dialog', { name: /New milestone on Body/ });
        await user.type(within(dialog).getByLabelText('Milestone'), 'Half marathon');
        await user.click(within(dialog).getByRole('button', { name: 'Add milestone' }));

        await waitFor(() => expect(api.milestonesCreated).toEqual([{ name: 'Half marathon', targetDate: null }]));
        dialog = await screen.findByRole('dialog', { name: /Half marathon/ });
        await user.click(within(dialog).getByRole('button', { name: 'Add a checkpoint' }));
        await user.type(within(dialog).getByLabelText('Checkpoint'), '14 km long run');
        await user.type(within(dialog).getByLabelText(/Reached at/), '14');
        await user.click(within(dialog).getByRole('button', { name: 'Add checkpoint' }));

        await waitFor(() => expect(api.checkpointsCreated).toHaveLength(1));
        expect(api.checkpointsCreated[0]).toMatchObject({ name: '14 km long run', statDefinitionId: 'gym', aggregation: 'COUNT_DAYS', targetValue: 14 });
        expect(await within(dialog).findByText(/14 km long run/)).toBeInTheDocument();
    });
});
