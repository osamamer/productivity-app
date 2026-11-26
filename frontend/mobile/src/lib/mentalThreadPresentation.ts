import type { AttentionState } from '../types/models';

export const threadStateColors: Record<AttentionState, string> = {
  ACTING: '#3478F6',
  RUMINATING: '#D14343',
  PLANNED: '#2F9D74',
  PENDING: '#D98B2B',
};
