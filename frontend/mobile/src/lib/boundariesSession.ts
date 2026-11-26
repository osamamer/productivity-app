const UNLOCK_DURATION_MS = 10 * 60 * 1000;
let unlockedUntil = 0;

// Keep the grace period across navigation, but never persist password authorization to disk.
export function unlockBoundaries(now = Date.now()): void {
  unlockedUntil = now + UNLOCK_DURATION_MS;
}

export function boundariesUnlockRemaining(now = Date.now()): number {
  return Math.max(0, unlockedUntil - now);
}

export function clearBoundariesSession(): void {
  unlockedUntil = 0;
}
