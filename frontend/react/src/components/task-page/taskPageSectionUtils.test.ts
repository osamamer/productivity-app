import { describe, expect, it } from 'vitest';
import { makeTask } from '../../test/fakeBackend';
import { buildTaskListItems as buildHomeTaskListItems } from '../../pages/home/homeTaskListItems';
import type { TaskGroup } from '../../types/TaskGroup';
import { buildTaskListItems } from './taskPageSectionUtils';

const first = makeTask({ taskId: 'first', name: 'First' });
const second = makeTask({ taskId: 'second', name: 'Second' });
const loose = makeTask({ taskId: 'loose', name: 'Loose' });
const group: TaskGroup = { groupId: 'g1', name: 'Errands', taskIds: ['first', 'second'], displayOrder: 0 };

describe('a group with only one of its tasks in the list', () => {
    it('stays a group on the Tasks page', () => {
        const items = buildTaskListItems([first, loose], [group]);

        expect(items.map(item => item.kind === 'group' ? `group:${item.group.name}` : item.task.name))
            .toEqual(['group:Errands', 'Loose']);
    });

    it('shows as the task alone on Home', () => {
        const items = buildHomeTaskListItems([first, loose], [group], id => id, 'today');

        expect(items.map(item => item.kind === 'group' ? `group:${item.group.name}` : item.task.name))
            .toEqual(['First', 'Loose']);
    });
});

describe('a group with several tasks in the list', () => {
    it('is a group on both pages', () => {
        expect(buildTaskListItems([first, second], [group])[0].kind).toBe('group');
        expect(buildHomeTaskListItems([first, second], [group], id => id, 'today')[0].kind).toBe('group');
    });
});
