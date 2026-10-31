import type { StatDefinition } from '@/types/models';
import type { AppColors } from '@/providers/ThemeProvider';

export function isBooleanValuePreferred(definition: StatDefinition, value: 0 | 1): boolean | null {
  if (definition.morality === 'GOOD' || definition.morality === 'NICE_TO_HAVE') return value === 1;
  if (definition.morality === 'BAD' || definition.morality === 'NICE_TO_AVOID') return value === 0;
  return null;
}

export function booleanStatColor(
  definition: StatDefinition,
  value: 0 | 1,
  colors: AppColors,
): string {
  const preferred = isBooleanValuePreferred(definition, value);
  if (preferred === null) return value === 1 ? colors.accent : colors.secondary;
  if (definition.morality === 'NICE_TO_HAVE' || definition.morality === 'NICE_TO_AVOID') {
    return preferred ? colors.success : colors.notPlanned;
  }
  return preferred ? colors.success : colors.danger;
}
