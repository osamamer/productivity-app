import type { StatDefinition, StatType } from '../../types/Stats';
import type {
    InputDirection, InputScoring, Path, PathIcon, SignalCombine, SignalDraft, SignalInputDraft,
} from '../../types/Path';
import { PATH_COLORS } from './pathIcons';

/** One input as the editor holds it: numbers as typed, durations in hours. */
export interface InputForm {
    statDefinitionId: string;
    valueSource: string;
    direction: InputDirection;
    scoring: InputScoring;
    target: string;
    weight: string;
}

export interface PathForm {
    name: string;
    color: string;
    icon: PathIcon;
    paused: boolean;
    combineMethod: SignalCombine;
    inputs: InputForm[];
}

export interface StatOption {
    definition: StatDefinition;
    label: string;
}

export const SCORING_OPTIONS: { value: InputScoring; label: string; help: string }[] = [
    { value: 'TIMES', label: 'Times a week', help: 'Days with an entry, or meeting the stat’s good threshold' },
    { value: 'TOTAL', label: 'Total a week', help: 'The week’s values added up' },
    { value: 'DAYS_MET', label: 'Days meeting a daily target', help: 'Out of the 7 days' },
    { value: 'AVERAGE', label: 'Daily average', help: 'Partial days count' },
];

/** Stats a signal can use, sub stats labelled under their parent; secret ones only while unlocked. */
export function statOptions(definitions: StatDefinition[], showSecret: boolean): StatOption[] {
    const byId = new Map(definitions.map(definition => [definition.id, definition]));
    return definitions
        .filter(definition => showSecret || !definition.secret)
        .map(definition => {
            const parent = definition.parentDefinitionId ? byId.get(definition.parentDefinitionId) : undefined;
            return { definition, label: parent ? `${parent.name} › ${definition.name}` : definition.name };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function valueTypeOf(definition: StatDefinition | undefined, valueSource: string): StatType | null {
    if (!definition) return null;
    return valueSource === 'VALUE' ? definition.type : valueSource as StatType;
}

function defaultDirection(definition: StatDefinition): InputDirection {
    return definition.morality === 'BAD' || definition.morality === 'NICE_TO_AVOID' ? 'LESS_IS_BETTER' : 'MORE_IS_BETTER';
}

export function newInput(definition: StatDefinition): InputForm {
    const counted = definition.type === 'BOOLEAN';
    return {
        statDefinitionId: definition.id,
        valueSource: 'VALUE',
        direction: defaultDirection(definition),
        scoring: counted ? 'TIMES' : 'TOTAL',
        target: counted ? '3' : '',
        weight: '1',
    };
}

/** The stat changed: keep the scoring and target only when they still make sense. */
export function withStat(input: InputForm, definition: StatDefinition): InputForm {
    return { ...newInput(definition), weight: input.weight };
}

export function emptyForm(existingPaths: number): PathForm {
    return {
        name: '',
        color: PATH_COLORS[existingPaths % PATH_COLORS.length],
        icon: 'mind',
        paused: false,
        combineMethod: 'AVERAGE',
        inputs: [],
    };
}

function shownTarget(target: number, valueType: StatType | null): string {
    const value = valueType === 'DURATION' ? target / 60 : target;
    return String(Math.round(value * 100) / 100);
}

export function formFromPath(path: Path): PathForm {
    return {
        name: path.name,
        color: path.color,
        icon: path.icon,
        paused: path.paused,
        combineMethod: path.signal.combineMethod,
        inputs: path.signal.inputs.map(input => ({
            statDefinitionId: input.statDefinitionId,
            valueSource: input.valueSource,
            direction: input.direction,
            scoring: input.scoring,
            target: shownTarget(input.target, input.valueType),
            weight: String(input.weight),
        })),
    };
}

/** The signal to send, or the first problem to show. */
export function toSignalDraft(form: PathForm, definitions: StatDefinition[]): SignalDraft | string {
    if (form.inputs.length === 0) return 'Add at least one stat to build the signal from.';
    const byId = new Map(definitions.map(definition => [definition.id, definition]));
    const inputs: SignalInputDraft[] = [];
    for (const input of form.inputs) {
        const definition = byId.get(input.statDefinitionId);
        if (!definition) return 'One of the inputs uses a stat that no longer exists.';
        const typed = Number(input.target.replace(',', '.'));
        if (input.target.trim() === '' || !Number.isFinite(typed) || typed < 0) return `Set a target for ${definition.name}.`;
        if (typed === 0 && input.direction === 'MORE_IS_BETTER') return `The target for ${definition.name} must be above zero.`;
        const weight = Number(input.weight.replace(',', '.'));
        if (!Number.isFinite(weight) || weight <= 0) return `The weight for ${definition.name} must be above zero.`;
        const durationInput = valueTypeOf(definition, input.valueSource) === 'DURATION';
        inputs.push({
            statDefinitionId: input.statDefinitionId,
            valueSource: input.valueSource,
            direction: input.direction,
            scoring: input.scoring,
            target: durationInput ? Math.round(typed * 60) : typed,
            weight,
        });
    }
    return { combineMethod: form.combineMethod, inputs };
}
