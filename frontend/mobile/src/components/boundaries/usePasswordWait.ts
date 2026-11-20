import { useEffect, useRef, useState } from 'react';

export const PASSWORD_WAIT_SECONDS = 10;

/**
 * The wait after a correct Boundaries password before the change goes through, so a boundary
 * is never loosened on impulse. `start(then)` runs `then` once the wait ends; `cancel` drops it.
 * Leaving the app re-locks Boundaries, which unmounts whatever is waiting.
 */
export function usePasswordWait() {
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (readyAt === null) return undefined;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current < readyAt) return;
      const then = pending.current;
      pending.current = null;
      setReadyAt(null);
      then?.();
    }, 200);
    return () => clearInterval(interval);
  }, [readyAt]);

  const start = (then: () => void) => {
    const started = Date.now();
    pending.current = then;
    setNow(started);
    setReadyAt(started + PASSWORD_WAIT_SECONDS * 1000);
  };

  const cancel = () => {
    pending.current = null;
    setReadyAt(null);
  };

  return {
    waiting: readyAt !== null,
    remaining: readyAt === null ? 0 : Math.max(0, Math.ceil((readyAt - now) / 1000)),
    start,
    cancel,
  };
}
