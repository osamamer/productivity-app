import type { StatDefinition } from '../../types/Stats';
import type { Checkpoint, CheckpointAggregation, CheckpointDraft } from '../../types/Path';
import { valueTypeOf } from './pathDraft';

/** A checkpoint as the editor holds it: numbers as typed, durations in hours, dates as yyyy-MM-dd. */
export interface CheckpointForm {
    name: string;
    targetDate: string;
    statDefinitionId: string;
    valueSource: string;
    aggregation: CheckpointAggregation;
    countFrom: string;
    baseline: string;
    target: string;
}

export const AGGREGATION_OPTIONS: { value: CheckpointAggregation; label: string; help: string }[] = [
    { value: 'SUM', label: 'Total since the start', help: 'Every logged value added up, plus the starting amount' },
    { value: 'COUNT_DAYS', label: 'Days logged since the start', help: 'Days with an entry, plus the starting amount' },
    { value: 'LATEST', label: 'Latest value', help: 'For things like a balance or a weight' },
];

function hoursIfDuration(value: number, durationInput: boolean): string {
    return String(Math.round((durationInput ? value / 60 : value) * 100) / 100);
}

export function newCheckpointForm(definition: StatDefinition | undefined, countFrom: string): CheckpointForm {
    return {
        name: '',
        targetDate: '',
        statDefinitionId: definition?.id ?? '',
        valueSource: 'VALUE',
        aggregation: definition?.type === 'BOOLEAN' ? 'COUNT_DAYS' : 'SUM',
        countFrom,
        baseline: '0',
        target: '',
    };
}

export function formFromCheckpoint(checkpoint: Checkpoint): CheckpointForm {
    const duration = checkpoint.metric.valueType === 'DURATION';
    return {
        name: checkpoint.name,
        targetDate: checkpoint.targetDate ?? '',
        statDefinitionId: checkpoint.metric.statDefinitionId,
        valueSource: checkpoint.metric.valueSource,
        aggregation: checkpoint.metric.aggregation,
        countFrom: checkpoint.metric.countFrom,
        baseline: hoursIfDuration(checkpoint.metric.baseline, duration),
        target: hoursIfDuration(checkpoint.metric.targetValue, duration),
    };
}

function parseNumber(text: string): number | null {
    const value = Number(text.replace(',', '.'));
    return text.trim() === '' || !Number.isFinite(value) ? null : value;
}

/** The checkpoint to send, or the first problem to show. Every checkpoint needs a stat and a target. */
export function toCheckpointDraft(form: CheckpointForm, definitions: StatDefinition[]): CheckpointDraft | string {
    if (!form.name.trim()) return 'Give the checkpoint a name.';
    const definition = definitions.find(item => item.id === form.statDefinitionId);
    if (!definition) return 'Choose the stat that measures this checkpoint.';
    const target = parseNumber(form.target);
    if (target === null) return 'Set the value that reaches this checkpoint.';
    const baseline = form.aggregation === 'LATEST' ? 0 : parseNumber(form.baseline || '0');
    if (baseline === null || baseline < 0) return 'The starting amount must be zero or more.';
    if (!form.countFrom) return 'Choose when counting starts.';
    const minutes = valueTypeOf(definition, form.valueSource) === 'DURATION' ? 60 : 1;
    return {
        name: form.name.trim(),
        targetDate: form.targetDate || null,
        statDefinitionId: definition.id,
        valueSource: form.valueSource,
        aggregation: form.aggregation,
        countFrom: form.countFrom,
        baseline: baseline * minutes,
        targetValue: target * minutes,
    };
}
