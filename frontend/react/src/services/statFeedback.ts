import { StatDefinition, StatEntryStatus, StatFeedback, StatMorality } from '../types/Stats';
import { playAudioFeedback } from './audioFeedback';
import { affirmStatLogged, celebrateStatLogged, reprimandStatLogged } from './statCelebration';
import type { CelebrationAnchor } from './statCelebration';
import { isTimeAtOrBeforeThreshold } from './utils/statValues';

type StatFeedbackOptions = {
    positiveEffect?: 'confetti' | 'pulse';
};

export function effectiveStatMorality(definition: StatDefinition): StatMorality {
    return definition.morality ?? 'NEUTRAL';
}

export function isNotPlanned(status?: StatEntryStatus): boolean {
    return status === 'NOT_PLANNED';
}

function meetsGoodThreshold(definition: StatDefinition, value: number): boolean | null {
    if (definition.type === 'BOOLEAN') {
        return effectiveStatMorality(definition) === 'GOOD' ? value === 1 : value === 0;
    }

    if (definition.goodThreshold == null) return null;
    if (definition.type === 'TIME') {
        // Time thresholds are upper bounds. sleep_time is compared on its
        // bedtime scale by isTimeAtOrBeforeThreshold; wake_up_time uses the
        // normal clock scale.
        return isTimeAtOrBeforeThreshold(definition, value, definition.goodThreshold);
    }

    return effectiveStatMorality(definition) === 'GOOD'
        ? value >= definition.goodThreshold
        : value <= definition.goodThreshold;
}

/** Neutral or unconfigured stats stay quiet; every judged result gets a clear outcome. */
export function getStatFeedback(definition: StatDefinition, value: number): StatFeedback {
    const morality = effectiveStatMorality(definition);
    if (morality === 'NEUTRAL') return 'NONE';

    const isGood = meetsGoodThreshold(definition, value);
    if (isGood == null) return 'NONE';
    return isGood ? 'CELEBRATE' : 'SAD';
}

export function getBooleanChoiceColor(
    definition: StatDefinition,
    value: 0 | 1,
    status: StatEntryStatus = 'RECORDED',
): 'primary' | 'secondary' | 'success' | 'error' | 'notPlanned' {
    if (status === 'NOT_PLANNED') return 'notPlanned';
    if (effectiveStatMorality(definition) === 'NEUTRAL') {
        return value === 1 ? 'primary' : 'secondary';
    }

    const feedback = getStatFeedback(definition, value);
    if (feedback === 'CELEBRATE') return 'success';
    if (feedback === 'SAD') return 'error';
    return value === 1 ? 'success' : 'error';
}

export function showStatFeedback(
    definition: StatDefinition,
    value: number,
    anchor?: CelebrationAnchor | null,
    options: StatFeedbackOptions = {},
): void {
    const feedback = getStatFeedback(definition, value);
    if (feedback === 'CELEBRATE') {
        playAudioFeedback('statGood');
        if (options.positiveEffect === 'pulse') affirmStatLogged(anchor);
        else celebrateStatLogged(anchor);
    }
    if (feedback === 'SAD') {
        playAudioFeedback('statBad');
        reprimandStatLogged(anchor);
    }
}
