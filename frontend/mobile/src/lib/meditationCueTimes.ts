export function remainingIntervalBellOffsets(
  intendedSeconds: number,
  elapsedSeconds: number,
  bellCount: number,
): number[] {
  if (intendedSeconds <= 0 || bellCount <= 0) return [];

  const interval = intendedSeconds / (bellCount + 1);
  return Array.from({ length: bellCount }, (_, index) => interval * (index + 1) - elapsedSeconds)
    .filter(offset => offset > 0);
}
