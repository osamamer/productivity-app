export const TASK_PRIORITY_OPTIONS = [
  { label: 'Low', value: 3, color: '#1976d2' },
  { label: 'Medium', value: 6, color: '#eab308' },
  { label: 'High', value: 9, color: '#ef4444' },
] as const;

export function taskPriorityLabel(importance: number): string {
  if (importance > 7) return 'High';
  if (importance > 4) return 'Medium';
  return 'Low';
}

export function taskPriorityValue(importance: number): number {
  const label = taskPriorityLabel(importance);
  return TASK_PRIORITY_OPTIONS.find(option => option.label === label)?.value ?? TASK_PRIORITY_OPTIONS[0].value;
}

export function taskPriorityColor(importance: number): string {
  const label = taskPriorityLabel(importance);
  return TASK_PRIORITY_OPTIONS.find(option => option.label === label)?.color ?? TASK_PRIORITY_OPTIONS[0].color;
}
