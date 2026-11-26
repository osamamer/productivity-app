import { StatDefinition } from '../../types/Stats';
import { topLevelStatDefinitions } from '../../services/utils/statDefinitionHierarchy';

export const DEDICATED_SYSTEM_KEYS = new Set([
    'meditated',
    'meditation_minutes',
    'energy',
    'activation',
    'stimulation_hunger',
    'clarity',
    'stimulation',
    'hunger',
    'arousal',
    'valence',
    'emotional_load',
]);

export const EDITABLE_SYSTEM_KEYS = new Set(['sleep_hours', 'sleep_time', 'wake_up_time']);

export function isEditableSystemStat(definition: StatDefinition): boolean {
    return definition.systemKey !== undefined && EDITABLE_SYSTEM_KEYS.has(definition.systemKey);
}

export function canCreateRecurringTask(definition: StatDefinition): boolean {
    return definition.type === 'BOOLEAN' && !definition.recurringTaskSeriesId;
}

export function isDedicatedStat(definition: StatDefinition): boolean {
    const isOptionalMeditationStat = definition.systemKey === 'meditated'
        && definition.showOnStatsPage;
    return definition.systemKey !== undefined
        && DEDICATED_SYSTEM_KEYS.has(definition.systemKey)
        && !isOptionalMeditationStat;
}

export function statListDefinitions(definitions: StatDefinition[]): StatDefinition[] {
    return topLevelStatDefinitions(definitions).filter(definition => !isDedicatedStat(definition));
}
