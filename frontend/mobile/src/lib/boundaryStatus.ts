import type { AppRule, AppUsage } from './boundaryRules';

export interface DailyStatus {
  limitMs: number;
  usedMs: number;
  leftMs: number;
}

export interface BoundaryStatusRow {
  pkg: string;
  daily: DailyStatus | null;
  // What the current open is doing, or null when the app has no time per open.
  session: string | null;
  // Whether an open is counting down right now.
  live: boolean;
  opensLabel: string;
}

const MINUTE_MS = 60_000;

/** "45 min" or "1 h 05 min", rounded up so a few seconds left still read as a minute. */
export function formatMinutes(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / MINUTE_MS);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`;
}

function daily(rule: AppRule, usedMs: number): DailyStatus | null {
  if (!rule.dailyLimitMin) return null;
  const limitMs = rule.dailyLimitMin * MINUTE_MS;
  return { limitMs, usedMs, leftMs: Math.max(0, limitMs - usedMs) };
}

function session(rule: AppRule, usage: AppUsage | undefined): { text: string | null; live: boolean } {
  if (!rule.sessionMin) return { text: null, live: false };
  if (!usage?.sessionActive) return { text: 'No open running', live: false };
  const leftMs = rule.sessionMin * MINUTE_MS - usage.sessionUsedMs;
  return { text: `${formatMinutes(leftMs)} left in this open`, live: true };
}

function opensLabel(rule: AppRule, opens: number): string {
  if (rule.maxOpens) return `${opens} of ${rule.maxOpens} opens today`;
  return `${opens} ${opens === 1 ? 'open' : 'opens'} today`;
}

/**
 * Where every app with a daily limit, open limit or time per open stands today, like the
 * desktop Boundaries "Today" list. Always-blocked apps have nothing to count and are left out.
 */
export function boundaryStatusRows(rules: AppRule[], usage: Record<string, AppUsage>): BoundaryStatusRow[] {
  return rules
    .filter(rule => rule.blockMode !== 'always' && (rule.dailyLimitMin || rule.maxOpens || rule.sessionMin))
    .map(rule => {
      const appUsage = usage[rule.pkg];
      const current = session(rule, appUsage);
      return {
        pkg: rule.pkg,
        daily: daily(rule, appUsage?.usedMs ?? 0),
        session: current.text,
        live: current.live,
        opensLabel: opensLabel(rule, appUsage?.opens ?? 0),
      };
    });
}
