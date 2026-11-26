import { localDate } from '../lib/date';
import { loadPage } from '../lib/pageCache';
import type { api } from './api';

type MeditationStatsSource = Pick<typeof api.stats, 'definitions' | 'summary' | 'entries'>;

export function meditationStatsRange(offset = 0, today = new Date()) {
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const from = localDate(month);
  const to = localDate(offset === 0 ? today : new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { from, to, key: `stats:meditation:${from}:${to}` };
}

export async function loadMeditationStats(from: string, to: string, stats: MeditationStatsSource) {
  const definitions = await loadPage('stat-definitions', stats.definitions);
  const meditated = definitions.find(definition => definition.systemKey === 'meditated');
  const minutes = definitions.find(definition => definition.systemKey === 'meditation_minutes');
  if (!meditated || !minutes) throw new Error('Meditation statistics are unavailable.');
  const [meditatedSummary, minutesSummary, meditatedEntries] = await Promise.all([
    stats.summary(meditated.id, from, to),
    stats.summary(minutes.id, from, to),
    stats.entries(meditated.id, from, to),
  ]);
  return { meditatedSummary, minutesSummary, meditatedEntries };
}
