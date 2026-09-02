import { StatDefinition, StatFeedback, StatMorality } from '../types/Stats';
import { celebrateStatLogged, reprimandStatLogged } from './statCelebration';

export function effectiveStatMorality(definition: StatDefinition): StatMorality {
    return definition.morality ?? 'NEUTRAL';
}

/**
 * Only a value that should prompt feedback gets an outcome. A GOOD stat stays
 * quiet below its threshold; a BAD stat gets a sad response above its threshold.
 */
export function getStatFeedback(definition: StatDefinition, value: number): StatFeedback {
    const morality = effectiveStatMorality(definition);

    if (morality === 'NEUTRAL') return 'NONE';
    if (definition.type === 'BOOLEAN') {
        if (morality === 'GOOD') return value === 1 ? 'CELEBRATE' : 'NONE';
        return value === 1 ? 'SAD' : 'CELEBRATE';
    }

    if (definition.goodThreshold == null) return 'NONE';
    if (morality === 'GOOD') return value >= definition.goodThreshold ? 'CELEBRATE' : 'NONE';
    return value <= definition.goodThreshold ? 'CELEBRATE' : 'SAD';
}

export function getBooleanChoiceColor(definition: StatDefinition, value: 0 | 1): 'success' | 'error' {
    const feedback = getStatFeedback(definition, value);
    if (feedback === 'CELEBRATE') return 'success';
    if (feedback === 'SAD') return 'error';
    return value === 1 ? 'success' : 'error';
}

export function showStatFeedback(
    definition: StatDefinition,
    value: number,
    anchor?: HTMLElement | null,
): void {
    const feedback = getStatFeedback(definition, value);
    if (feedback === 'CELEBRATE') celebrateStatLogged(anchor);
    if (feedback === 'SAD') reprimandStatLogged(anchor);
}
