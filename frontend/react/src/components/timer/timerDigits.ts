// Raleway's figures differ in width, so a ticking countdown shifts sideways even with
// tabular-nums. Roboto is bundled with the app (works offline) and its digits share one width.
export const TIMER_DIGITS_SX = {
    fontFamily: 'Roboto, Arial, sans-serif',
    fontVariantNumeric: 'tabular-nums',
} as const;
