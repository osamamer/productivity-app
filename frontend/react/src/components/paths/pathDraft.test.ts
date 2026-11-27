import { describe, expect, it } from 'vitest';
import type { StatDefinition } from '../../types/Stats';
import type { Path } from '../../types/Path';
import { emptyForm, formFromPath, newInput, statOptions, toSignalDraft, type PathForm } from './pathDraft';

function stat(overrides: Partial<StatDefinition> & Pick<StatDefinition, 'id' | 'name'>): StatDefinition {
    return { type: 'NUMBER', displayOrder: 0, userId: 'user', ...overrides };
}

const gym = stat({ id: 'gym', name: 'Gym', type: 'BOOLEAN', morality: 'GOOD' });
const writing = stat({ id: 'writing', name: 'Writing', type: 'BOOLEAN', additionalInputTypes: ['DURATION'] });
const words = stat({ id: 'words', name: 'Words', parentDefinitionId: 'writing' });
const takeaways = stat({ id: 'takeaways', name: 'Takeaways', morality: 'BAD' });
const diary = stat({ id: 'diary', name: 'Diary', secret: true });

describe('stat options', () => {
    it('labels sub stats under their parent and hides secret stats while locked', () => {
        expect(statOptions([gym, writing, words, diary], false).map(option => option.label))
            .toEqual(['Gym', 'Writing', 'Writing › Words']);
        expect(statOptions([diary], true).map(option => option.label)).toEqual(['Diary']);
    });
});

describe('new inputs', () => {
    it('count yes/no stats and take their direction from the stat', () => {
        expect(newInput(gym)).toMatchObject({ scoring: 'TIMES', target: '3', direction: 'MORE_IS_BETTER' });
        expect(newInput(takeaways)).toMatchObject({ scoring: 'TOTAL', target: '', direction: 'LESS_IS_BETTER' });
    });
});

describe('turning the form into a signal', () => {
    const form = (inputs: PathForm['inputs']): PathForm => ({ ...emptyForm(0), name: 'Writer', inputs });

    it('needs at least one input and a target for each', () => {
        expect(toSignalDraft(form([]), [gym])).toMatch(/at least one/);
        expect(toSignalDraft(form([newInput(takeaways)]), [takeaways])).toBe('Set a target for Takeaways.');
    });

    it('sends durations in minutes though they are typed in hours', () => {
        const input = { ...newInput(writing), valueSource: 'DURATION', target: '2.5' };
        const draft = toSignalDraft(form([input]), [writing]);
        expect(typeof draft === 'string' ? draft : draft.inputs[0].target).toBe(150);
    });

    it('allows a zero target only when less is better', () => {
        expect(toSignalDraft(form([{ ...newInput(gym), target: '0' }]), [gym])).toMatch(/above zero/);
        expect(typeof toSignalDraft(form([{ ...newInput(takeaways), target: '0' }]), [takeaways])).toBe('object');
    });

    it('round-trips a saved path, durations back in hours', () => {
        const path: Path = {
            id: 'p', name: 'Writer', color: '#A395F2', icon: 'writer', displayOrder: 0, paused: false,
            signal: { combineMethod: 'WEAKEST', inputs: [{
                id: 'i', statDefinitionId: 'writing', statName: 'Writing', unit: null, valueSource: 'DURATION', valueType: 'DURATION',
                direction: 'MORE_IS_BETTER', period: 'WEEK', scoring: 'TOTAL', target: 150, weight: 1,
            }] },
        };
        const restored = formFromPath(path);
        expect(restored.inputs[0].target).toBe('2.5');
        expect(toSignalDraft(restored, [writing])).toEqual({ combineMethod: 'WEAKEST', inputs: [{
            statDefinitionId: 'writing', valueSource: 'DURATION', direction: 'MORE_IS_BETTER', scoring: 'TOTAL', target: 150, weight: 1,
        }] });
    });
});
