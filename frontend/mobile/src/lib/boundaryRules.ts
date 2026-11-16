// Same shape as AppRule.kt in modules/claritard-boundaries; keep the two in sync.

export interface TimeWindow {
  /** 0 = Sunday .. 6 = Saturday */
  days: number[];
  /** minutes since midnight; end <= start wraps past midnight; start == end = whole day */
  start: number;
  end: number;
}

export type BlockMode = 'off' | 'always' | 'scheduled';

export interface AppRule {
  pkg: string;
  blockMode: BlockMode;
  blockWindows: TimeWindow[];
  /** 0 = no limit */
  dailyLimitMin: number;
  /** 0 = unlimited */
  maxOpens: number;
  /** minutes each open lasts before the app is force-quit; 0 = no per-open cap */
  sessionMin: number;
  /** when the limits apply; empty = always */
  limitWindows: TimeWindow[];
}

export interface AppUsage {
  usedMs: number;
  opens: number;
  sessionUsedMs: number;
  sessionActive: boolean;
}

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function emptyRule(pkg: string): AppRule {
  return {
    pkg,
    blockMode: 'off',
    blockWindows: [],
    dailyLimitMin: 0,
    maxOpens: 0,
    sessionMin: 0,
    limitWindows: [],
  };
}

export function hasLimits(r: AppRule): boolean {
  return r.dailyLimitMin > 0 || r.maxOpens > 0 || r.sessionMin > 0;
}

/** A rule that does nothing (no block, no limits). */
export function isNoop(r: AppRule): boolean {
  return (r.blockMode === 'off' || (r.blockMode === 'scheduled' && r.blockWindows.length === 0)) && !hasLimits(r);
}

export function windowContains(w: TimeWindow, day: number, minute: number): boolean {
  if (w.start === w.end) return w.days.includes(day);
  if (w.start < w.end) return w.days.includes(day) && minute >= w.start && minute < w.end;
  const prev = (day + 6) % 7;
  return (w.days.includes(day) && minute >= w.start) || (w.days.includes(prev) && minute < w.end);
}

function blockedAt(r: AppRule, day: number, minute: number): boolean {
  if (r.blockMode === 'always') return true;
  if (r.blockMode === 'scheduled') return r.blockWindows.some(w => windowContains(w, day, minute));
  return false;
}

function limitsAt(r: AppRule, day: number, minute: number): boolean {
  if (!hasLimits(r)) return false;
  if (r.limitWindows.length === 0) return true;
  return r.limitWindows.some(w => windowContains(w, day, minute));
}

const lim = (n: number) => (n > 0 ? n : Infinity);

/**
 * True if `next` is less restrictive than `prev` at any minute of the week - i.e. saving it
 * would loosen a restriction and should need the master password. `next` null = rule removed.
 */
export function isLooser(prev: AppRule | undefined, next: AppRule | null): boolean {
  if (!prev || isNoop(prev)) return false;
  if (!next) return true;
  const limitsLooser =
    hasLimits(prev) &&
    (lim(next.dailyLimitMin) > lim(prev.dailyLimitMin) ||
      lim(next.maxOpens) > lim(prev.maxOpens) ||
      lim(next.sessionMin) > lim(prev.sessionMin));
  for (let day = 0; day < 7; day++) {
    for (let minute = 0; minute < 1440; minute++) {
      const nextBlocked = blockedAt(next, day, minute);
      if (blockedAt(prev, day, minute) && !nextBlocked) return true;
      if (limitsAt(prev, day, minute) && !nextBlocked) {
        if (!limitsAt(next, day, minute) || limitsLooser) return true;
      }
    }
  }
  return false;
}

export function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Parses "H:MM" / "HH:MM" (24h). Returns null if invalid. */
export function parseTime(s: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function formatDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return sorted.map(d => names[d]).join(' ');
}

export function formatWindow(w: TimeWindow): string {
  const time = w.start === w.end ? 'all day' : `${formatTime(w.start)}–${formatTime(w.end)}`;
  return `${formatDays(w.days)} ${time}`;
}

export function summarizeRule(r: AppRule): string {
  const parts: string[] = [];
  if (r.blockMode === 'always') parts.push('Blocked');
  if (r.blockMode === 'scheduled' && r.blockWindows.length > 0) {
    parts.push(`Blocked ${r.blockWindows.map(formatWindow).join(', ')}`);
  }
  if (r.blockMode !== 'always' && hasLimits(r)) {
    const l: string[] = [];
    if (r.dailyLimitMin > 0) l.push(`${r.dailyLimitMin} min/day`);
    if (r.maxOpens > 0) l.push(`${r.maxOpens} opens/day`);
    if (r.sessionMin > 0) l.push(`${r.sessionMin} min/open`);
    let s = l.join(', ');
    if (r.limitWindows.length > 0) s += ` (${r.limitWindows.map(formatWindow).join(', ')})`;
    parts.push(s);
  }
  return parts.join(' · ') || 'No restriction';
}

export function summarizeUsage(r: AppRule, u: AppUsage | undefined): string | null {
  if (r.blockMode === 'always' || !hasLimits(r)) return null;
  const used = u ? Math.floor(u.usedMs / 60000) : 0;
  const opens = u ? u.opens : 0;
  const parts: string[] = [];
  parts.push(r.dailyLimitMin > 0 ? `${used}/${r.dailyLimitMin} min` : `${used} min`);
  if (r.maxOpens > 0) parts.push(`${opens}/${r.maxOpens} opens`);
  else parts.push(`${opens} opens`);
  return `Today: ${parts.join(', ')}`;
}
